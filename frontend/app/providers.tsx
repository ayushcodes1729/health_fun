"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import { RPC_URL } from "@/lib/solana/config";

import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  // Wallet Standard wallets (Phantom, Solflare, Backpack, ...) register
  // themselves, so no adapters need listing here.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider
      endpoint={RPC_URL}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
