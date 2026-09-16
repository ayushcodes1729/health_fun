import Link from "next/link";

const columns = [
  {
    heading: "Product",
    links: [
      { href: "/challenge", label: "Challenge" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/profile", label: "Profile" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "https://explorer.solana.com/?cluster=devnet", label: "Solana Explorer", external: true },
      { href: "https://solana.com", label: "Solana", external: true },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "#", label: "Terms" },
      { href: "#", label: "Privacy" },
    ],
  },
];

const socials = [
  { href: "#", label: "X" },
  { href: "#", label: "Discord" },
  { href: "#", label: "GitHub" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/8">
      <div className="shell py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-3">
            <p className="font-display text-lg font-bold uppercase italic tracking-[0.2em] text-accent">
              health_fun
            </p>
            <p className="max-w-xs text-sm leading-6 text-white/50">
              Stake on your steps. Hit your goal every day, on-chain, or forfeit to the treasury.
            </p>
            <div className="flex gap-3 pt-1">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-white/60 transition hover:border-accent hover:text-accent"
                >
                  {s.label.slice(0, 1)}
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{col.heading}</p>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {"external" in l && l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/60 transition hover:text-accent"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-white/60 transition hover:text-accent">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/8 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} health_fun. All rights reserved.</p>
          <p className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built on Solana · Devnet
          </p>
        </div>
      </div>
    </footer>
  );
}
