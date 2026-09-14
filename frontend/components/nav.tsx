"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useAccount } from "@/hooks/use-account";

const links = [
  { href: "/", label: "Challenge" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const { account, signOut } = useAccount();

  return (
    <nav className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-1">
        <Link href="/" className="mr-3 text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          health_fun
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              pathname === l.href ? "bg-slate-950 text-white" : "text-slate-600 hover:text-slate-950"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {account === undefined ? null : account ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">{account.displayName ?? account.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-950"
            >
              Sign out
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/google/login"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-950"
          >
            Sign in with Google
          </a>
        )}
        <WalletMultiButton />
      </div>
    </nav>
  );
}
