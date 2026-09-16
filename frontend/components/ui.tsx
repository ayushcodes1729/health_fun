import type { ReactNode } from "react";

/** Small shared primitives so the cards read as one system. */

export function Card({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-white/15 ${className}`}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-accent text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] hover:brightness-110 hover:shadow-[0_0_32px_-4px_rgba(142,255,54,0.75)]"
      : "border border-white/15 text-white/70 hover:border-accent hover:text-accent";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "border-red-400/25 bg-red-400/10 text-red-300",
    info: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    success: "border-accent/30 bg-accent/10 text-accent",
  }[kind];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
