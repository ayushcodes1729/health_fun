"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useAccount } from "@/hooks/use-account";

const links = [
  { href: "/challenge", label: "Challenge" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const { account, signOut } = useAccount();
  const [open, setOpen] = useState(false);

  // Collapse the mobile menu whenever navigation actually happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navLinks = links.map((l) => (
    <Link
      key={l.href}
      href={l.href}
      onClick={() => setOpen(false)}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        pathname === l.href ? "bg-accent text-accent-foreground" : "text-white/60 hover:text-white"
      }`}
    >
      {l.label}
    </Link>
  ));

  const authControls = (
    <>
      {account === undefined ? null : account ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="inline">{account.displayName ?? account.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </div>
      ) : (
        <a
          href="/api/auth/google/login"
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-accent hover:text-accent"
        >
          Sign in with Google
        </a>
      )}
      <WalletMultiButton />
    </>
  );

  return (
    <nav className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur sm:rounded-full">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-display text-sm font-bold uppercase italic tracking-[0.24em] text-accent"
        >
          health_fun
        </Link>

        <div className="hidden items-center gap-1 sm:flex">{navLinks}</div>
        <div className="hidden items-center gap-3 sm:flex">{authControls}</div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-full border border-white/15 transition hover:border-accent sm:hidden"
        >
          <span
            className={`h-0.5 w-4 rounded-full bg-white transition-transform duration-200 ${open ? "translate-y-[7px] rotate-45" : ""}`}
          />
          <span className={`h-0.5 w-4 rounded-full bg-white transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-0.5 w-4 rounded-full bg-white transition-transform duration-200 ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        </button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-white/8 pt-4 sm:hidden">
          <div className="flex flex-col gap-1">{navLinks}</div>
          <div className="flex flex-col items-start gap-3">{authControls}</div>
        </div>
      ) : null}
    </nav>
  );
}
