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
      className={`rounded-[1.5rem] border border-black/10 bg-white/90 p-6 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur ${className}`}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
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
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-slate-950 text-white hover:bg-slate-800"
      : "border border-slate-300 text-slate-700 hover:border-slate-950 hover:text-slate-950";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[kind];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
