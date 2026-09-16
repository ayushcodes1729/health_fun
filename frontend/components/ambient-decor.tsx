/**
 * Purely decorative side rails, styled after stepn.com's diagonal hazard
 * stripes and drifting glyphs. Absolutely positioned inside a `relative`
 * full-bleed wrapper so it can reach past the (narrower) content column.
 * Hidden below lg: there's no side gutter to put it in on small screens.
 */
export function AmbientDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
      {/* top-left hazard stripe corner */}
      <div className="stripe-block absolute -left-10 -top-10 h-40 w-40 -rotate-6" />
      {/* bottom-right hazard stripe corner */}
      <div className="stripe-block absolute -bottom-10 -right-10 h-40 w-40 -rotate-6" />

      {/* left rail glyphs */}
      <span className="absolute left-[4%] top-[18%] h-3 w-3 animate-drift-y rounded-full border-2 border-accent/60" />
      <span className="absolute left-[8%] top-[38%] animate-drift-y-slow text-2xl text-accent/50">+</span>
      <span className="absolute left-[3%] top-[58%] h-2 w-2 animate-pulse-glow rounded-full bg-accent/70" />
      <span
        className="absolute left-[9%] top-[74%] animate-drift-y text-xl text-white/30"
        style={{ animationDelay: "1.2s" }}
      >
        ×
      </span>
      <span className="absolute left-[2%] top-[85%] h-16 w-px animate-pulse-glow bg-gradient-to-b from-transparent via-accent/40 to-transparent" />

      {/* right rail glyphs */}
      <span
        className="absolute right-[5%] top-[22%] h-4 w-4 animate-spin-slow rounded-full border-2 border-dashed border-accent/50"
      />
      <span
        className="absolute right-[9%] top-[44%] animate-drift-y text-xl text-white/30"
        style={{ animationDelay: "0.6s" }}
      >
        +
      </span>
      <span className="absolute right-[3%] top-[62%] h-2 w-2 animate-pulse-glow rounded-full bg-accent/70" />
      <span
        className="absolute right-[8%] top-[80%] animate-drift-y-slow text-2xl text-accent/50"
        style={{ animationDelay: "1.6s" }}
      >
        ×
      </span>
      <span className="absolute right-[2%] top-[12%] h-16 w-px animate-pulse-glow bg-gradient-to-b from-transparent via-accent/40 to-transparent" />
    </div>
  );
}
