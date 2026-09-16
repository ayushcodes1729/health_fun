"use client";

import { useState } from "react";
import Link from "next/link";

const anchors = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#community", label: "Community" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  const anchorLinks = anchors.map((a) => (
    <a
      key={a.href}
      href={a.href}
      onClick={() => setOpen(false)}
      className="rounded-full px-3 py-1.5 text-sm font-medium text-white/60 transition hover:text-white"
    >
      {a.label}
    </a>
  ));

  const ctaLinks = (
    <>
      <Link
        href="/sign-in"
        onClick={() => setOpen(false)}
        className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-accent hover:text-accent"
      >
        Sign in
      </Link>
      <Link
        href="/challenge"
        onClick={() => setOpen(false)}
        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] transition hover:brightness-110"
      >
        Launch app
      </Link>
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

        <div className="hidden items-center gap-1 sm:flex">{anchorLinks}</div>
        <div className="hidden items-center gap-3 sm:flex">{ctaLinks}</div>

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
          <div className="flex flex-col gap-1">{anchorLinks}</div>
          <div className="flex flex-col items-start gap-3">{ctaLinks}</div>
        </div>
      ) : null}
    </nav>
  );
}
