import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

import { getFaucetKeypair } from "@/lib/server/keys";
import { RPC_URL, STAKE_MINT, STAKE_MINT_DECIMALS } from "@/lib/solana/config";

/** Devnet only. Mints a fixed allowance of the test token to the caller. */
const FAUCET_AMOUNT = BigInt(1_000) * BigInt(10) ** BigInt(STAKE_MINT_DECIMALS);

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_CLUSTER === "mainnet-beta") {
    return NextResponse.json({ error: "Faucet is devnet only" }, { status: 403 });
  }

  let wallet: PublicKey;
  try {
    const body = (await request.json()) as { wallet?: string };
    if (!body.wallet) throw new Error("missing wallet");
    wallet = new PublicKey(body.wallet);
  } catch {
    return NextResponse.json({ error: "Invalid or missing wallet address" }, { status: 400 });
  }

  const faucet = getFaucetKeypair();
  const connection = new Connection(RPC_URL, "confirmed");
  const ata = getAssociatedTokenAddressSync(STAKE_MINT, wallet, false);

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      faucet.publicKey,
      ata,
      wallet,
      STAKE_MINT
    ),
    createMintToInstruction(
      STAKE_MINT,
      ata,
      faucet.publicKey,
      FAUCET_AMOUNT,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  try {
    const signature = await sendAndConfirmTransaction(connection, tx, [faucet], {
      commitment: "confirmed",
    });
    return NextResponse.json({ signature, amount: FAUCET_AMOUNT.toString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}
