import { PublicKey } from "@solana/web3.js";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Client-safe configuration. Everything here is NEXT_PUBLIC_ and ends up in
 * the browser bundle, so nothing secret belongs in this file.
 */
export const RPC_URL = required(
  "NEXT_PUBLIC_RPC_URL",
  process.env.NEXT_PUBLIC_RPC_URL
);

export const PROGRAM_ID = new PublicKey(
  required("NEXT_PUBLIC_PROGRAM_ID", process.env.NEXT_PUBLIC_PROGRAM_ID)
);

/** The SPL mint users stake. On devnet this is the test mint with a faucet. */
export const STAKE_MINT = new PublicKey(
  required("NEXT_PUBLIC_STAKE_MINT", process.env.NEXT_PUBLIC_STAKE_MINT)
);

export const STAKE_MINT_DECIMALS = Number(
  process.env.NEXT_PUBLIC_STAKE_MINT_DECIMALS ?? "6"
);

export const STAKE_MINT_SYMBOL = process.env.NEXT_PUBLIC_STAKE_MINT_SYMBOL ?? "HFT";

export const SECONDS_PER_DAY = 86_400;
