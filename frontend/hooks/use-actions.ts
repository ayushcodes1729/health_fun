"use client";

import { useCallback, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { formatEpochDay } from "@/lib/format";
import { STAKE_MINT } from "@/lib/solana/config";
import {
  attestationFromJson,
  buildAttestationMessage,
  buildEd25519VerifyInstruction,
  INSTRUCTIONS_SYSVAR,
  type AttestationJson,
} from "@/lib/solana/attestation";
import {
  healthDataPda,
  stakeAccountPda,
  stakeConfigPda,
  treasuryAuthorityPda,
  treasuryConfigPda,
  treasuryVaultAta,
  userAta,
  userProfilePda,
  vaultPda,
} from "@/lib/solana/pdas";

import { useProgram } from "./use-program";

export type ActionState = {
  busy: string | null;
  error: string | null;
  lastSignature: string | null;
  /** Human-readable note about the last successful action, e.g. steps synced. */
  lastMessage: string | null;
};

export type StepsPreview = { epochDay: number; steps: number };

export type OracleResponse = {
  attestation: AttestationJson;
  signature: string; // base64
  oraclePubkey: string;
};

/**
 * Every transaction the user signs. Each returns the signature and lets the
 * caller refresh state afterwards; errors surface as strings for the UI.
 */
export function useActions(onSettled?: () => Promise<void>) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const program = useProgram();

  const [state, setState] = useState<ActionState>({
    busy: null,
    error: null,
    lastSignature: null,
    lastMessage: null,
  });

  const run = useCallback(
    async (
      label: string,
      fn: (user: PublicKey) => Promise<string | { signature: string; message: string }>
    ) => {
      if (!publicKey) {
        setState((s) => ({ ...s, error: "Connect a wallet first" }));
        return null;
      }
      setState({ busy: label, error: null, lastSignature: null, lastMessage: null });
      try {
        const out = await fn(publicKey);
        const sig = typeof out === "string" ? out : out.signature;
        const message = typeof out === "string" ? null : out.message;
        setState({ busy: null, error: null, lastSignature: sig, lastMessage: message });
        await onSettled?.();
        return sig;
      } catch (e) {
        setState({
          busy: null,
          error: humanizeError(e),
          lastSignature: null,
          lastMessage: null,
        });
        return null;
      }
    },
    [publicKey, onSettled]
  );

  /** What Google Fit reports for yesterday, without touching the chain. */
  const previewSteps = useCallback(async (): Promise<StepsPreview | { error: string }> => {
    if (!publicKey) return { error: "Connect a wallet first" };
    const res = await fetch("/api/oracle/attest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: publicKey.toBase58(), preview: true }),
    });
    const body = (await res.json()) as StepsPreview | { error: string };
    return body;
  }, [publicKey]);

  const send = useCallback(
    async (tx: Transaction) => {
      const sig = await sendTransaction(tx, connection);
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      return sig;
    },
    [connection, sendTransaction]
  );

  /** One-time per wallet. The oracle key is read from on-chain config. */
  const initializeHealth = useCallback(
    () =>
      run("Initializing health account", async (user) => {
        const config = await program.account.stakeConfig.fetch(stakeConfigPda());
        const ix = await program.methods
          .initializeHealthData(config.verificationKey)
          .accountsStrict({
            user,
            healthData: healthDataPda(user),
            stakeConfig: stakeConfigPda(),
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        return send(new Transaction().add(ix));
      }),
    [program, run, send]
  );

  /** Creates the challenge and funds the vault atomically. */
  const stake = useCallback(
    (amountBaseUnits: bigint, totalDays: number, stepsPerDay: number) =>
      run("Staking", async (user) => {
        const ix = await program.methods
          .stake(
            new BN(amountBaseUnits.toString()),
            totalDays,
            { steps: {} },
            stepsPerDay
          )
          .accountsStrict({
            user,
            stakeAccount: stakeAccountPda(user),
            stakeConfig: stakeConfigPda(),
            userProfile: userProfilePda(user),
            mint: STAKE_MINT,
            vault: vaultPda(user),
            userAta: userAta(STAKE_MINT, user),
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        return send(new Transaction().add(ix));
      }),
    [program, run, send]
  );

  /**
   * Asks the oracle route for a signed attestation of the user's Google Fit
   * data, then submits it. The ed25519 verify instruction must immediately
   * precede update_health_data in the same transaction.
   */
  const sync = useCallback(
    () =>
      run("Syncing steps", async (user) => {
        const res = await fetch("/api/oracle/attest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: user.toBase58() }),
        });
        const body = (await res.json()) as OracleResponse | { error: string };
        if (!res.ok || "error" in body) {
          throw new Error("error" in body ? body.error : "Oracle request failed");
        }

        const attestation = attestationFromJson(body.attestation);
        const message = buildAttestationMessage(attestation);
        const oracleSignature = Buffer.from(body.signature, "base64");
        const oracle = new PublicKey(body.oraclePubkey);

        const verifyIx = buildEd25519VerifyInstruction(oracle, message, oracleSignature);
        const updateIx = await program.methods
          .updateHealthData({
            challengeId: new BN(attestation.challengeId.toString()),
            user: attestation.user,
            steps: attestation.steps,
            sleepHours: attestation.sleepHours,
            gym: attestation.gym,
            epochDay: attestation.epochDay,
            nonce: new BN(attestation.nonce.toString()),
            expiresAt: new BN(attestation.expiresAt.toString()),
          })
          .accountsStrict({
            user,
            healthData: healthDataPda(user),
            stakeConfig: stakeConfigPda(),
            stakeAccount: stakeAccountPda(user),
            instructions: INSTRUCTIONS_SYSVAR,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const txSignature = await send(new Transaction().add(verifyIx).add(updateIx));
        return {
          signature: txSignature,
          message: `Synced ${attestation.steps.toLocaleString()} steps for ${formatEpochDay(attestation.epochDay)} (UTC)`,
        };
      }),
    [program, run, send]
  );

  const claim = useCallback(
    () =>
      run("Claiming", async (user) => {
        const ata = userAta(STAKE_MINT, user);
        const ix = await program.methods
          .claim()
          .accountsStrict({
            user,
            stakeAccount: stakeAccountPda(user),
            userProfile: userProfilePda(user),
            stakeConfig: stakeConfigPda(),
            treasuryConfig: treasuryConfigPda(STAKE_MINT),
            vault: vaultPda(user),
            treasuryAuthority: treasuryAuthorityPda(STAKE_MINT),
            treasuryVault: treasuryVaultAta(STAKE_MINT),
            userAta: ata,
            mint: STAKE_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        // The payout needs the user's ATA to exist; idempotent so it is safe
        // to include every time.
        const ensureAta = createAssociatedTokenAccountIdempotentInstruction(
          user,
          ata,
          user,
          STAKE_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        return send(new Transaction().add(ensureAta).add(ix));
      }),
    [program, run, send]
  );

  /** Devnet only: asks the faucet route to mint test tokens to this wallet. */
  const faucet = useCallback(
    () =>
      run("Requesting test tokens", async (user) => {
        const res = await fetch("/api/faucet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: user.toBase58() }),
        });
        const body = (await res.json()) as { signature?: string; error?: string };
        if (!res.ok || !body.signature) {
          throw new Error(body.error ?? "Faucet request failed");
        }
        return body.signature;
      }),
    [run]
  );

  return { ...state, initializeHealth, stake, sync, claim, faucet, previewSteps };
}

/** Pulls the Anchor error name out of a simulation log dump when present. */
function humanizeError(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  const m = text.match(/Error Message: ([^.\n]+)/);
  if (m) return m[1];
  const code = text.match(/Error Code: (\w+)/);
  if (code) return code[1];
  if (text.includes("User rejected")) return "Transaction cancelled in wallet";
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}
