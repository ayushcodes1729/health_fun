import Link from "next/link";

import { AmbientDecor } from "@/components/ambient-decor";
import { LandingNav } from "@/components/landing-nav";
import { SiteFooter } from "@/components/site-footer";
import { Testimonials } from "@/components/testimonials";

const stats = [
  { label: "Steps synced", value: "18,402,119" },
  { label: "Tokens staked", value: "412,830 HFT" },
  { label: "Goal-met rate", value: "91%" },
];

const steps = [
  {
    step: "01",
    title: "Connect",
    body: "Link a Solana wallet and sign in with Google to authorize Google Fit as your step source.",
  },
  {
    step: "02",
    title: "Stake",
    body: "Lock tokens against a daily step goal for a set number of days. You pick the number, the goal, the stakes.",
  },
  {
    step: "03",
    title: "Sync or forfeit",
    body: "Each morning, sync yesterday's steps. Hit the goal every single day and claim it all back — miss one and it's gone.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <div className="relative">
        <AmbientDecor />
        <div className="shell relative flex flex-col gap-16 pb-24 pt-10">
          <LandingNav />

          <section className="grid gap-6 pt-8 text-center sm:pt-16">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
              Move-to-earn, on-chain
            </p>
            <h1 className="mx-auto max-w-4xl font-display text-5xl font-bold italic leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Stake on your steps. Get paid to show up.
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
              Lock tokens against a daily step goal. Hit it every day and get it all back — miss
              one day and it&apos;s forfeited to the treasury. No admin to plead with; the chain
              decides.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/challenge"
                className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] transition hover:brightness-110"
              >
                Launch app
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-accent hover:text-accent"
              >
                Sign in
              </Link>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-center"
              >
                <p className="font-display text-3xl font-semibold tabular-nums text-accent sm:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  {s.label}
                </p>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="shell flex flex-col gap-24 py-24">
        <section id="how-it-works" className="grid gap-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-bold italic tracking-tight text-white sm:text-4xl">
              Three steps. Zero excuses.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.step}
                className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-6 transition hover:border-white/15"
              >
                <p className="font-display text-4xl font-bold italic text-accent/40">{s.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="community">
          <Testimonials />
        </section>

        <section className="rounded-[2rem] border border-accent/20 bg-[radial-gradient(circle_at_top,rgba(142,255,54,0.12)_0%,transparent_70%)] p-10 text-center sm:p-16">
          <h2 className="mx-auto max-w-xl font-display text-3xl font-bold italic tracking-tight text-white sm:text-4xl">
            Ready to put a price on your goals?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
            Connect a wallet, set a goal, and stake something that actually hurts to lose.
          </p>
          <Link
            href="/challenge"
            className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] transition hover:brightness-110"
          >
            Launch app
          </Link>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
