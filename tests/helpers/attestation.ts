import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import nacl from "tweetnacl";

export const INSTRUCTIONS_SYSVAR = new web3.PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);

export const ED25519_PROGRAM_ID = new web3.PublicKey(
  "Ed25519SigVerify111111111111111111111111111"
);

export type Attestation = {
  challengeId: anchor.BN;
  user: web3.PublicKey;
  steps: number;
  sleepHours: number;
  gym: boolean;
  epochDay: number;
  nonce: anchor.BN;
  expiresAt: anchor.BN;
};

function toU64(n: anchor.BN): bigint {
  return BigInt(n.toString());
}

/**
 * Mirrors `build_attestation_message` in the program. The byte order here and
 * in update_health_data.rs must stay identical or every signature check fails.
 */
export function buildAttestationMessage(params: Attestation): Buffer {
  const buf = Buffer.alloc(9 + 32 + 8 + 2 + 4 + 1 + 1 + 8 + 8);
  let o = 0;

  buf.write("HEALTH_V1", o, "ascii");
  o += 9;
  params.user.toBuffer().copy(buf, o);
  o += 32;
  buf.writeBigUInt64LE(toU64(params.challengeId), o);
  o += 8;
  buf.writeUInt16LE(params.epochDay, o);
  o += 2;
  buf.writeUInt32LE(params.steps, o);
  o += 4;
  buf.writeUInt8(params.sleepHours, o);
  o += 1;
  buf.writeUInt8(params.gym ? 1 : 0, o);
  o += 1;
  buf.writeBigUInt64LE(toU64(params.nonce), o);
  o += 8;
  buf.writeBigInt64LE(BigInt(params.expiresAt.toString()), o);

  return buf;
}

/** Builds the single-signature layout the Ed25519 precompile expects. */
export function buildEd25519IxData(
  signature: Uint8Array,
  publicKey: Uint8Array,
  message: Buffer
): Buffer {
  const SIG_OFF = 16;
  const PK_OFF = SIG_OFF + 64;
  const MSG_OFF = PK_OFF + 32;

  const buf = Buffer.alloc(MSG_OFF + message.length);

  buf.writeUInt8(1, 0);
  buf.writeUInt8(0, 1);
  buf.writeUInt16LE(SIG_OFF, 2);
  buf.writeUInt16LE(0xffff, 4);
  buf.writeUInt16LE(PK_OFF, 6);
  buf.writeUInt16LE(0xffff, 8);
  buf.writeUInt16LE(MSG_OFF, 10);
  buf.writeUInt16LE(message.length, 12);
  buf.writeUInt16LE(0xffff, 14);

  Buffer.from(signature).copy(buf, SIG_OFF);
  Buffer.from(publicKey).copy(buf, PK_OFF);
  message.copy(buf, MSG_OFF);

  return buf;
}

export function makeEd25519VerifyIx(
  oracle: web3.Keypair,
  message: Buffer
): web3.TransactionInstruction {
  const sig = nacl.sign.detached(message, oracle.secretKey);
  const data = buildEd25519IxData(sig, oracle.publicKey.toBytes(), message);
  return new web3.TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data,
  });
}

export function findStakeConfigPda(programId: web3.PublicKey): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  )[0];
}

export function findUserPdas(programId: web3.PublicKey, user: web3.PublicKey) {
  const stakePda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), user.toBuffer()],
    programId
  )[0];
  const vaultPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), user.toBuffer()],
    programId
  )[0];
  const healthPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("health"), user.toBuffer()],
    programId
  )[0];
  return { stakePda, vaultPda, healthPda };
}

export function findProfilePda(
  programId: web3.PublicKey,
  user: web3.PublicKey
): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), user.toBuffer()],
    programId
  )[0];
}

export function findTreasuryAuthorityPda(
  programId: web3.PublicKey,
  mint: web3.PublicKey
): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_authority"), mint.toBuffer()],
    programId
  )[0];
}

export function findTreasuryConfigPda(
  programId: web3.PublicKey,
  mint: web3.PublicKey
): web3.PublicKey {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury_config"), mint.toBuffer()],
    programId
  )[0];
}
