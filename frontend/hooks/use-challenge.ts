"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { STAKE_MINT } from "@/lib/solana/config";
import {
  healthDataPda,
  stakeAccountPda,
  stakeConfigPda,
  userAta,
  userProfilePda,
} from "@/lib/solana/pdas";
import type {
  HealthData,
  StakeAccount,
  StakeConfig,
  UserProfile,
} from "@/lib/solana/program";

import { useProgram } from "./use-program";

export type ChallengeState = {
  loading: boolean;
  error: string | null;
  config: StakeConfig | null;
  stake: StakeAccount | null;
  health: HealthData | null;
  profile: UserProfile | null;
  /** User's balance of the stake mint, in base units. null if no ATA yet. */
  tokenBalance: bigint | null;
  refresh: () => Promise<void>;
};

/**
 * Everything the dashboard needs about the connected wallet, fetched together
 * and refreshed on demand after each transaction. Missing accounts are
 * `null`, not errors: a user with no stake, no health account, or no profile
 * is the normal starting state.
 */
export function useChallenge(): ChallengeState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const program = useProgram();

  const [state, setState] = useState<Omit<ChallengeState, "refresh">>({
    loading: false,
    error: null,
    config: null,
    stake: null,
    health: null,
    profile: null,
    tokenBalance: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const config = await program.account.stakeConfig
        .fetchNullable(stakeConfigPda())
        .catch(() => null);

      if (!publicKey) {
        setState({
          loading: false,
          error: null,
          config,
          stake: null,
          health: null,
          profile: null,
          tokenBalance: null,
        });
        return;
      }

      const [stake, health, profile, ata] = await Promise.all([
        program.account.stakeAccount.fetchNullable(stakeAccountPda(publicKey)),
        program.account.healthData.fetchNullable(healthDataPda(publicKey)),
        program.account.userProfile.fetchNullable(userProfilePda(publicKey)),
        getAccount(
          connection,
          userAta(STAKE_MINT, publicKey),
          "confirmed",
          TOKEN_PROGRAM_ID
        ).catch(() => null),
      ]);

      setState({
        loading: false,
        error: null,
        config,
        stake,
        health,
        profile,
        tokenBalance: ata ? ata.amount : null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [connection, program, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
