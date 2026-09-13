import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

import idl from "@/lib/idl/health_fun.json";
import type { HealthFun } from "@/lib/idl/health_fun";

/**
 * The subset of Anchor's Wallet that AnchorProvider actually uses. The
 * browser wallet adapter satisfies this; Anchor's own `Wallet` type also
 * demands a `payer` Keypair that only exists server-side.
 */
export type BrowserWallet = {
  publicKey: PublicKey;
  signTransaction: AnchorProvider["wallet"]["signTransaction"];
  signAllTransactions: AnchorProvider["wallet"]["signAllTransactions"];
};

/**
 * Anchor `Program` bound to a connection. When no wallet is connected a
 * read-only provider is used so account fetches still work; any attempt to
 * send a transaction through it will fail loudly, which is the right outcome.
 */
export function getProgram(
  connection: Connection,
  wallet?: BrowserWallet
): Program<HealthFun> {
  const provider = new AnchorProvider(
    connection,
    (wallet ?? readOnlyWallet()) as AnchorProvider["wallet"],
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  return new Program<HealthFun>(idl as HealthFun, provider);
}

function readOnlyWallet(): BrowserWallet {
  const reject = () =>
    Promise.reject(new Error("Connect a wallet to sign transactions"));
  return {
    publicKey: PublicKey.default,
    signTransaction: reject,
    signAllTransactions: reject,
  };
}

export type StakeAccount = Awaited<
  ReturnType<Program<HealthFun>["account"]["stakeAccount"]["fetch"]>
>;
export type HealthData = Awaited<
  ReturnType<Program<HealthFun>["account"]["healthData"]["fetch"]>
>;
export type UserProfile = Awaited<
  ReturnType<Program<HealthFun>["account"]["userProfile"]["fetch"]>
>;
export type StakeConfig = Awaited<
  ReturnType<Program<HealthFun>["account"]["stakeConfig"]["fetch"]>
>;
