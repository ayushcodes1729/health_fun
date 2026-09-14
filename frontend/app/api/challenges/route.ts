import { NextResponse } from "next/server";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import idl from "@/lib/idl/health_fun.json";
import { getCurrentUser } from "@/lib/server/users";
import { PROGRAM_ID, RPC_URL } from "@/lib/solana/config";
import { stakeAccountPda } from "@/lib/solana/pdas";

/**
 * Challenge history for the signed-in user's linked wallet.
 *
 * The chain is the source of truth but keeps no per-challenge account after
 * claim (rent is returned); only the ChallengeSettled event in transaction
 * logs survives, and RPC nodes prune those. So this route back-fills new
 * settlements from chain into the `challenges` table on every call, then
 * serves from the table. Back-fill walks the stake PDA's signatures newest
 * first and stops at the first one already stored.
 */
type SettledEvent = {
  user: PublicKey;
  mint: PublicKey;
  stakedAmount: { toString(): string };
  totalDays: number;
  daysGoalMet: number;
  goalPerDay: number;
  won: boolean;
  stakedAt: { toString(): string };
  settledAt: { toString(): string };
};

async function backfill(userId: string, wallet: PublicKey): Promise<number> {
  const connection = new Connection(RPC_URL, "confirmed");
  const parser = new EventParser(PROGRAM_ID, new BorshCoder(idl as never));
  const stakePda = stakeAccountPda(wallet);

  const known = new Set(
    (
      await db
        .select({ sig: schema.challenges.settleSignature })
        .from(schema.challenges)
        .where(eq(schema.challenges.walletAddress, wallet.toBase58()))
    ).map((r) => r.sig)
  );

  const sigs = await connection.getSignaturesForAddress(stakePda, { limit: 200 }, "confirmed");
  let inserted = 0;

  for (const s of sigs) {
    if (known.has(s.signature)) break; // everything older is already stored
    if (s.err) continue;

    const tx = await connection.getTransaction(s.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const logs = tx?.meta?.logMessages;
    if (!logs) continue;

    for (const ev of parser.parseLogs(logs)) {
      if (ev.name !== "ChallengeSettled") continue;
      const d = ev.data as SettledEvent;
      if (!d.user.equals(wallet)) continue;

      await db
        .insert(schema.challenges)
        .values({
          userId,
          walletAddress: wallet.toBase58(),
          mint: d.mint.toBase58(),
          stakedAmount: BigInt(d.stakedAmount.toString()),
          totalDays: d.totalDays,
          goalPerDay: d.goalPerDay,
          daysGoalMet: d.daysGoalMet,
          won: d.won,
          stakedAt: new Date(Number(d.stakedAt.toString()) * 1000),
          settledAt: new Date(Number(d.settledAt.toString()) * 1000),
          settleSignature: s.signature,
          slot: BigInt(s.slot),
        })
        .onConflictDoNothing();
      inserted += 1;
    }
  }
  return inserted;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  if (!user.walletAddress) return NextResponse.json({ challenges: [], backfilled: 0 });

  const wallet = new PublicKey(user.walletAddress);
  let backfilled = 0;
  let backfillError: string | null = null;
  try {
    backfilled = await backfill(user.id, wallet);
  } catch (e) {
    // Serve what we have; the table is the durable copy.
    backfillError = e instanceof Error ? e.message : String(e);
  }

  const rows = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.walletAddress, wallet.toBase58()))
    .orderBy(desc(schema.challenges.settledAt));

  return NextResponse.json({
    challenges: rows.map((r) => ({ ...r, stakedAmount: r.stakedAmount.toString(), slot: r.slot.toString() })),
    backfilled,
    backfillError,
  });
}
