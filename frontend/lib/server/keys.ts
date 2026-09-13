import "server-only";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Server-side signing keys, loaded from environment. Accepts either a base58
 * secret key or the JSON byte array `solana-keygen` writes.
 *
 * These are the only secrets the web server holds. The oracle key attests
 * health data; the faucet key is mint authority for the DEVNET test token
 * only. Neither is the program admin key, which should never live on a web
 * server.
 */
function keypairFromEnv(name: string): Keypair {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const trimmed = raw.trim();
  const bytes = trimmed.startsWith("[")
    ? Uint8Array.from(JSON.parse(trimmed) as number[])
    : bs58.decode(trimmed);

  return Keypair.fromSecretKey(bytes);
}

let oracle: Keypair | undefined;
let faucet: Keypair | undefined;

export function getOracleKeypair(): Keypair {
  return (oracle ??= keypairFromEnv("ORACLE_SECRET_KEY"));
}

export function getFaucetKeypair(): Keypair {
  return (faucet ??= keypairFromEnv("FAUCET_SECRET_KEY"));
}
