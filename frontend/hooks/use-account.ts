"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { linkMessage } from "@/lib/wallet-link";

export type Account = {
  id: string;
  email: string;
  displayName: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bio: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  createdAt: string;
};

/**
 * The signed-in Google account (from the HMAC-signed session cookie) and the
 * actions that mutate it. `null` account means not signed in.
 */
export function useAccount() {
  const { publicKey, signMessage } = useWallet();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const body = (await res.json()) as { user: Account | null };
      setAccount(body.user);
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const withBusy = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      try {
        await fn();
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh]
  );

  /** Proves control of the connected wallet by signing, then links it. */
  const linkWallet = useCallback(
    () =>
      withBusy("Linking wallet", async () => {
        if (!publicKey || !signMessage) throw new Error("Connect a wallet that supports message signing");
        if (!account?.email) throw new Error("Sign in with Google first");
        const issuedAt = Date.now();
        const message = new TextEncoder().encode(
          linkMessage(account.email, publicKey.toBase58(), issuedAt)
        );
        const signature = await signMessage(message);
        const res = await fetch("/api/wallet/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: publicKey.toBase58(),
            signature: Buffer.from(signature).toString("base64"),
            issuedAt,
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not link wallet");
      }),
    [account?.email, publicKey, signMessage, withBusy]
  );

  const unlinkWallet = useCallback(
    () =>
      withBusy("Unlinking wallet", async () => {
        const res = await fetch("/api/wallet/link", { method: "DELETE" });
        if (!res.ok) throw new Error("Could not unlink wallet");
      }),
    [withBusy]
  );

  const updateProfile = useCallback(
    (patch: Partial<Pick<Account, "displayName" | "age" | "heightCm" | "weightKg" | "bio">>) =>
      withBusy("Saving", async () => {
        const res = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not save profile");
      }),
    [withBusy]
  );

  const signOut = useCallback(
    () =>
      withBusy("Signing out", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
      }),
    [withBusy]
  );

  return { account, busy, error, refresh, linkWallet, unlinkWallet, updateProfile, signOut };
}
