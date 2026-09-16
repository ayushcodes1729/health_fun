"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { AmbientDecor } from "@/components/ambient-decor";
import { useAccount } from "@/hooks/use-account";

export default function SignInPage() {
  const router = useRouter();
  const { account } = useAccount();

  useEffect(() => {
    if (account) router.replace("/challenge");
  }, [account, router]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black bg-[radial-gradient(circle_at_top,rgba(142,255,54,0.1)_0%,rgba(5,5,5,0.4)_38%,#000000_75%)] text-white">
      <AmbientDecor />

      <div className="relative mx-auto flex min-h-screen w-[92%] max-w-md flex-col justify-center gap-8 py-16">
        <Link
          href="/"
          className="mx-auto font-display text-sm font-bold uppercase italic tracking-[0.24em] text-accent"
        >
          health_fun
        </Link>

        <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Welcome</p>
          <h1 className="mt-2 font-display text-3xl font-bold italic tracking-tight text-white">
            Sign in to start staking
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Connect your Google account to sync steps from Google Fit, or connect a Solana wallet
            to explore the challenge on devnet.
          </p>

          <a
            href="/api/auth/google/login"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] transition hover:brightness-110"
          >
            Continue with Google
          </a>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/30">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex justify-center">
            <WalletMultiButton />
          </div>

          <p className="mt-6 text-xs text-white/40">
            New here?{" "}
            <Link href="/" className="text-accent hover:underline">
              See how it works
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
