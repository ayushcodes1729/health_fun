import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import nacl from "tweetnacl";

/**
 * Shared between the oracle API route (which signs) and the browser (which
 * builds the ed25519 verify instruction). Must stay byte-for-byte identical to
 * `build_attestation_message` in update_health_data.rs.
 */

export const ED25519_PROGRAM_ID = new PublicKey(
  "Ed25519SigVerify111111111111111111111111111"
);

export const INSTRUCTIONS_SYSVAR = new PublicKey(
  "Sysvar1nstructions1111111111111111111111111"
);

/** Wire form of AttestationData. bigint fields are serialised as strings in JSON. */
export type Attestation = {
  challengeId: bigint;
  user: PublicKey;
  steps: number;
  sleepHours: number;
  gym: boolean;
  /** Whole days since the Unix epoch: unix_timestamp / 86400. */
  epochDay: number;
  nonce: bigint;
  expiresAt: bigint;
};

export type AttestationJson = {
  challengeId: string;
  user: string;
  steps: number;
  sleepHours: number;
  gym: boolean;
  epochDay: number;
  nonce: string;
  expiresAt: string;
};

export function attestationToJson(a: Attestation): AttestationJson {
  return {
    challengeId: a.challengeId.toString(),
    user: a.user.toBase58(),
    steps: a.steps,
    sleepHours: a.sleepHours,
    gym: a.gym,
    epochDay: a.epochDay,
    nonce: a.nonce.toString(),
    expiresAt: a.expiresAt.toString(),
  };
}

export function attestationFromJson(j: AttestationJson): Attestation {
  return {
    challengeId: BigInt(j.challengeId),
    user: new PublicKey(j.user),
    steps: j.steps,
    sleepHours: j.sleepHours,
    gym: j.gym,
    epochDay: j.epochDay,
    nonce: BigInt(j.nonce),
    expiresAt: BigInt(j.expiresAt),
  };
}

export function buildAttestationMessage(a: Attestation): Buffer {
  const buf = Buffer.alloc(9 + 32 + 8 + 2 + 4 + 1 + 1 + 8 + 8);
  let o = 0;

  buf.write("HEALTH_V1", o, "ascii");
  o += 9;
  a.user.toBuffer().copy(buf, o);
  o += 32;
  buf.writeBigUInt64LE(a.challengeId, o);
  o += 8;
  buf.writeUInt16LE(a.epochDay, o);
  o += 2;
  buf.writeUInt32LE(a.steps, o);
  o += 4;
  buf.writeUInt8(a.sleepHours, o);
  o += 1;
  buf.writeUInt8(a.gym ? 1 : 0, o);
  o += 1;
  buf.writeBigUInt64LE(a.nonce, o);
  o += 8;
  buf.writeBigInt64LE(a.expiresAt, o);

  return buf;
}

/** Signs on the server. Never call this in the browser. */
export function signAttestation(
  message: Buffer,
  oracleSecretKey: Uint8Array
): Uint8Array {
  return nacl.sign.detached(message, oracleSecretKey);
}

/**
 * Builds the single-signature Ed25519 precompile instruction. The program
 * requires this to be the instruction immediately before update_health_data
 * in the same transaction, and hand-parses this exact layout.
 */
export function buildEd25519VerifyInstruction(
  oraclePubkey: PublicKey,
  message: Buffer,
  signature: Uint8Array
): TransactionInstruction {
  const SIG_OFF = 16;
  const PK_OFF = SIG_OFF + 64;
  const MSG_OFF = PK_OFF + 32;

  const data = Buffer.alloc(MSG_OFF + message.length);
  data.writeUInt8(1, 0);
  data.writeUInt8(0, 1);
  data.writeUInt16LE(SIG_OFF, 2);
  data.writeUInt16LE(0xffff, 4);
  data.writeUInt16LE(PK_OFF, 6);
  data.writeUInt16LE(0xffff, 8);
  data.writeUInt16LE(MSG_OFF, 10);
  data.writeUInt16LE(message.length, 12);
  data.writeUInt16LE(0xffff, 14);

  Buffer.from(signature).copy(data, SIG_OFF);
  oraclePubkey.toBuffer().copy(data, PK_OFF);
  message.copy(data, MSG_OFF);

  return new TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data,
  });
}
