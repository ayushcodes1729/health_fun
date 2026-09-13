import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { fetchStepsForEpochDay } from "@/lib/google-fit-data";
import { getOracleKeypair } from "@/lib/server/keys";
import {
  attestationToJson,
  buildAttestationMessage,
  signAttestation,
  type Attestation,
} from "@/lib/solana/attestation";
import { RPC_URL, SECONDS_PER_DAY } from "@/lib/solana/config";
import { healthDataPda, stakeAccountPda } from "@/lib/solana/pdas";
import { getProgram } from "@/lib/solana/program";

/**
 * The oracle. Reads the caller's Google Fit steps for the most recent
 * COMPLETE day and returns a signed attestation the user submits themselves
 * (update_health_data requires the user's signature, so the server cannot
 * push this on a schedule).
 *
 * Why yesterday and not today: an attested day can never be re-attested
 * (the program requires epoch_day to strictly increase), so attesting today
 * at 10am would lock in a partial count. Yesterday is always final.
 *
 * Trust boundary: this route signs whatever Google Fit reports for the
 * session cookie's account. The user chooses the wallet address; nothing
 * here ties the Google account to the wallet, so a user could attest their
 * own steps to any wallet. That is acceptable for a devnet MVP and must be
 * addressed (e.g. wallet-signed login bound to the Google identity) before
 * real value is at stake.
 */
export async function POST(request: NextRequest) {
  let user: PublicKey;
  try {
    const body = (await request.json()) as { user?: string };
    if (!body.user) throw new Error("missing user");
    user = new PublicKey(body.user);
  } catch {
    return NextResponse.json({ error: "Invalid or missing wallet address" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const today = Math.floor(now / SECONDS_PER_DAY);
  const epochDay = today - 1;

  // Refuse to sign something the program will reject anyway, with a clearer
  // message than the on-chain error.
  const connection = new Connection(RPC_URL, "confirmed");
  const program = getProgram(connection);
  const [stake, health] = await Promise.all([
    program.account.stakeAccount.fetchNullable(stakeAccountPda(user)),
    program.account.healthData.fetchNullable(healthDataPda(user)),
  ]);

  if (!stake) {
    return NextResponse.json(
      { error: "No active challenge for this wallet" },
      { status: 409 }
    );
  }
  if (!health) {
    return NextResponse.json(
      { error: "Health account not initialized for this wallet" },
      { status: 409 }
    );
  }
  if (health.epochDay >= epochDay) {
    return NextResponse.json(
      { error: "Yesterday is already synced. Come back tomorrow." },
      { status: 409 }
    );
  }

  const result = await fetchStepsForEpochDay(epochDay);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const oracle = getOracleKeypair();
  const attestation: Attestation = {
    // The program does not validate this; it is an identifier for indexers.
    challengeId: BigInt(stake.stakedAt.toString()),
    user,
    steps: result.steps,
    sleepHours: 0,
    gym: false,
    epochDay,
    // Must strictly increase per user. Milliseconds are monotonic enough for
    // one sync per day and need no server-side state.
    nonce: BigInt(Date.now()),
    expiresAt: BigInt(now + 10 * 60),
  };

  const message = buildAttestationMessage(attestation);
  const signature = signAttestation(message, oracle.secretKey);

  return NextResponse.json({
    attestation: attestationToJson(attestation),
    signature: Buffer.from(signature).toString("base64"),
    oraclePubkey: oracle.publicKey.toBase58(),
  });
}
