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
  // Written with DataView rather than Buffer's BigInt methods: the Buffer
  // polyfill Next.js ships to the browser lacks writeBigUInt64LE, so the
  // Node-only version crashed the sync in the browser while passing every
  // server-side test.
  const bytes = new Uint8Array(9 + 32 + 8 + 2 + 4 + 1 + 1 + 8 + 8);
  const view = new DataView(bytes.buffer);
  let o = 0;

  bytes.set(new TextEncoder().encode("HEALTH_V1"), o);
  o += 9;
  bytes.set(a.user.toBytes(), o);
  o += 32;
  view.setBigUint64(o, a.challengeId, true);
  o += 8;
  view.setUint16(o, a.epochDay, true);
  o += 2;
  view.setUint32(o, a.steps, true);
  o += 4;
  view.setUint8(o, a.sleepHours);
  o += 1;
  view.setUint8(o, a.gym ? 1 : 0);
  o += 1;
  view.setBigUint64(o, a.nonce, true);
  o += 8;
  view.setBigInt64(o, a.expiresAt, true);

  return Buffer.from(bytes);
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
  message: Uint8Array,
  signature: Uint8Array
): TransactionInstruction {
  const SIG_OFF = 16;
  const PK_OFF = SIG_OFF + 64;
  const MSG_OFF = PK_OFF + 32;

  const data = new Uint8Array(MSG_OFF + message.length);
  const view = new DataView(data.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, 0);
  view.setUint16(2, SIG_OFF, true);
  view.setUint16(4, 0xffff, true);
  view.setUint16(6, PK_OFF, true);
  view.setUint16(8, 0xffff, true);
  view.setUint16(10, MSG_OFF, true);
  view.setUint16(12, message.length, true);
  view.setUint16(14, 0xffff, true);

  data.set(signature, SIG_OFF);
  data.set(oraclePubkey.toBytes(), PK_OFF);
  data.set(message, MSG_OFF);

  return new TransactionInstruction({
    programId: ED25519_PROGRAM_ID,
    keys: [],
    data: Buffer.from(data),
  });
}
