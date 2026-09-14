import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { eq } from "drizzle-orm";
import nacl from "tweetnacl";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/users";
import { linkMessage } from "@/lib/wallet-link";

const MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });

  let wallet: PublicKey;
  let signature: Uint8Array;
  let issuedAt: number;
  try {
    const body = (await request.json()) as { wallet: string; signature: string; issuedAt: number };
    wallet = new PublicKey(body.wallet);
    signature = Buffer.from(body.signature, "base64");
    issuedAt = Number(body.issuedAt);
    if (!Number.isFinite(issuedAt)) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (Math.abs(Date.now() - issuedAt) > MAX_AGE_MS) {
    return NextResponse.json({ error: "Signature expired; try again" }, { status: 400 });
  }

  const message = new TextEncoder().encode(linkMessage(user.email, wallet.toBase58(), issuedAt));
  if (!nacl.sign.detached.verify(message, signature, wallet.toBytes())) {
    return NextResponse.json({ error: "Signature does not match wallet" }, { status: 400 });
  }

  const taken = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, wallet.toBase58()),
  });
  if (taken && taken.id !== user.id) {
    return NextResponse.json(
      { error: "That wallet is already linked to another account" },
      { status: 409 }
    );
  }

  await db
    .update(schema.users)
    .set({ walletAddress: wallet.toBase58(), walletLinkedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  return NextResponse.json({ ok: true, walletAddress: wallet.toBase58() });
}

/** Unlink; the wallet can then be linked to a different account. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in with Google first" }, { status: 401 });
  await db
    .update(schema.users)
    .set({ walletAddress: null, walletLinkedAt: null, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  return NextResponse.json({ ok: true });
}
