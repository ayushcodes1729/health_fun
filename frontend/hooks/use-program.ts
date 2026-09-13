"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";

import { getProgram } from "@/lib/solana/program";

/** Anchor Program bound to the current connection and (if any) wallet. */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => getProgram(connection, wallet), [connection, wallet]);
}
