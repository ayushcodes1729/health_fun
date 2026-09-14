"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAccount } from "@/hooks/use-account";

import { Button, Card, Notice } from "./ui";

export function ProfileForm({ onboarding }: { onboarding: boolean }) {
  const router = useRouter();
  const { account, busy, error, updateProfile, unlinkWallet } = useAccount();

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  // Populate once the account loads; don't clobber edits on later refreshes.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!account || seeded) return;
    setDisplayName(account.displayName ?? "");
    setAge(account.age?.toString() ?? "");
    setHeightCm(account.heightCm?.toString() ?? "");
    setWeightKg(account.weightKg?.toString() ?? "");
    setBio(account.bio ?? "");
    setSeeded(true);
  }, [account, seeded]);

  if (account === undefined) return null;
  if (!account) {
    return (
      <Card eyebrow="Profile" title="Sign in to set up your profile">
        <a
          href="/api/auth/google/login"
          className="mt-2 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign in with Google
        </a>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const ok = await updateProfile({
      displayName,
      age: age === "" ? null : Number(age),
      heightCm: heightCm === "" ? null : Number(heightCm),
      weightKg: weightKg === "" ? null : Number(weightKg),
      bio: bio === "" ? null : bio,
    });
    if (ok) {
      setSaved(true);
      if (onboarding) router.push("/");
    }
  };

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          {onboarding ? "Welcome" : "Profile"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {onboarding ? "Tell us a little about yourself" : "Your details"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Signed in as {account.email}</p>
      </header>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {saved && !onboarding ? <Notice kind="success">Saved.</Notice> : null}

      <Card>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
          <Field label="Display name" value={displayName} onChange={setDisplayName} required className="sm:col-span-2" />
          <Field label="Age" value={age} onChange={setAge} inputMode="numeric" />
          <Field label="Height (cm)" value={heightCm} onChange={setHeightCm} inputMode="numeric" />
          <Field label="Weight (kg)" value={weightKg} onChange={setWeightKg} inputMode="numeric" />
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              className="rounded-xl border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy !== null || displayName.trim() === ""}>
              {busy === "Saving" ? "Saving…" : onboarding ? "Continue" : "Save"}
            </Button>
          </div>
        </form>
      </Card>

      {!onboarding ? (
        <Card eyebrow="Account" title="Linked wallet">
          {account.walletAddress ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-sm text-slate-700">{account.walletAddress}</p>
              <Button variant="secondary" onClick={() => void unlinkWallet()} disabled={busy !== null}>
                Unlink
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No wallet linked. Link one from the Challenge page.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "text";
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        value={value}
        required={required}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
      />
    </label>
  );
}
