const testimonials = [
  {
    quote:
      "I've tried every habit app out there. None of them hurt when I skip a day — this one actually costs me something.",
    name: "Priya N.",
    role: "42-day streak",
  },
  {
    quote:
      "Staked 200 tokens on 8,000 steps a day for a month. Missed one day early on, tightened up, never missed again.",
    name: "Marcus O.",
    role: "3 challenges completed",
  },
  {
    quote:
      "The on-chain settlement is what sold me — no app admin can quietly waive a missed day. The contract doesn't care about excuses.",
    name: "Ade K.",
    role: "Devnet tester",
  },
];

export function Testimonials() {
  return (
    <section className="grid gap-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Community</p>
        <h2 className="mt-2 font-display text-3xl font-bold italic tracking-tight text-white sm:text-4xl">
          People who put their tokens where their steps are
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {testimonials.map((t) => (
          <figure
            key={t.name}
            className="flex flex-col justify-between rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition hover:border-white/15"
          >
            <blockquote className="text-sm leading-6 text-white/70">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
                {t.name.slice(0, 1)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{t.name}</span>
                <span className="block text-xs text-white/40">{t.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
