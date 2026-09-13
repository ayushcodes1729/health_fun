"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useActions } from "@/hooks/use-actions";
import { useChallenge } from "@/hooks/use-challenge";
import {
  SECONDS_PER_DAY,
  STAKE_MINT_DECIMALS,
  STAKE_MINT_SYMBOL,
} from "@/lib/solana/config";

import { Button, Card, Notice, Stat } from "./ui";

function formatTokens(baseUnits: bigint | number | { toString(): string }): string {
  const n = BigInt(baseUnits.toString());
  const d = BigInt(10) ** BigInt(STAKE_MINT_DECIMALS);
  const whole = n / d;
  const frac = (n % d).toString().padStart(STAKE_MINT_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ChallengeDashboard() {
  const { publicKey } = useWallet();
  const challenge = useChallenge();
  const actions = useActions(challenge.refresh);

  const nowSec = Math.floor(Date.now() / 1000);
  const todayEpochDay = Math.floor(nowSec / SECONDS_PER_DAY);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            health_fun
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Stake on your steps. Hit the goal every day or forfeit.
          </h1>
        </div>
        <WalletMultiButton />
      </header>

      {actions.error ? <Notice kind="error">{actions.error}</Notice> : null}
      {challenge.error ? <Notice kind="error">{challenge.error}</Notice> : null}
      {actions.lastSignature ? (
        <Notice kind="success">
          Confirmed:{" "}
          <a
            className="underline"
            href={`https://explorer.solana.com/tx/${actions.lastSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            {actions.lastSignature.slice(0, 8)}…{actions.lastSignature.slice(-8)}
          </a>
        </Notice>
      ) : null}

      {!publicKey ? (
        <Card eyebrow="Step 1" title="Connect a wallet">
          <p className="text-sm text-slate-600">
            Connect a Solana wallet on devnet to see or start a challenge.
          </p>
        </Card>
      ) : null}

      {publicKey && !challenge.config && !challenge.loading ? (
        <Notice kind="error">
          The program config account was not found on this cluster. Run the devnet setup script.
        </Notice>
      ) : null}

      {publicKey ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label={`${STAKE_MINT_SYMBOL} balance`}
            value={challenge.tokenBalance === null ? "—" : formatTokens(challenge.tokenBalance)}
            hint={challenge.tokenBalance === null ? "No token account yet" : undefined}
          />
          <Stat
            label="Completed"
            value={challenge.profile?.challengesCompleted ?? 0}
            hint={`${challenge.profile?.challengesFailed ?? 0} forfeited`}
          />
          <Stat
            label="Streak"
            value={challenge.profile?.currentStreak ?? 0}
            hint={`best ${challenge.profile?.longestStreak ?? 0}`}
          />
        </div>
      ) : null}

      {publicKey && (challenge.tokenBalance === null || challenge.tokenBalance === 0n) ? (
        <Card eyebrow="Devnet" title="Get test tokens">
          <p className="text-sm text-slate-600">
            You need {STAKE_MINT_SYMBOL} to stake. The devnet faucet mints 1,000 to your wallet.
          </p>
          <div className="mt-4">
            <Button onClick={() => void actions.faucet()} disabled={actions.busy !== null}>
              {actions.busy === "Requesting test tokens" ? "Minting…" : "Request 1,000 tokens"}
            </Button>
          </div>
        </Card>
      ) : null}

      {publicKey && !challenge.health && challenge.config ? (
        <Card eyebrow="Step 2" title="Initialize your health account">
          <p className="text-sm text-slate-600">
            One-time setup. This creates the on-chain account your daily step syncs are written to.
          </p>
          <div className="mt-4">
            <Button onClick={() => void actions.initializeHealth()} disabled={actions.busy !== null}>
              {actions.busy === "Initializing health account" ? "Initializing…" : "Initialize"}
            </Button>
          </div>
        </Card>
      ) : null}

      {publicKey && challenge.health && !challenge.stake && challenge.config ? (
        <StakeForm
          busy={actions.busy}
          balance={challenge.tokenBalance ?? 0n}
          maxStake={BigInt(challenge.config.maxStake.toString())}
          minDays={Math.max(1, Math.ceil(Number(challenge.config.minLockDuration) / SECONDS_PER_DAY))}
          maxDays={Math.floor(Number(challenge.config.maxLockDuration) / SECONDS_PER_DAY)}
          onStake={(amount, days, steps) => void actions.stake(amount, days, steps)}
        />
      ) : null}

      {publicKey && challenge.stake ? (
        <ActiveChallenge
          stake={challenge.stake}
          healthEpochDay={challenge.health?.epochDay ?? 0}
          lastSteps={challenge.health?.steps ?? 0}
          nowSec={nowSec}
          todayEpochDay={todayEpochDay}
          busy={actions.busy}
          onSync={() => void actions.sync()}
          onClaim={() => void actions.claim()}
        />
      ) : null}
    </div>
  );
}

function StakeForm({
  busy,
  balance,
  maxStake,
  minDays,
  maxDays,
  onStake,
}: {
  busy: string | null;
  balance: bigint;
  maxStake: bigint;
  minDays: number;
  maxDays: number;
  onStake: (amountBaseUnits: bigint, days: number, stepsPerDay: number) => void;
}) {
  const [amount, setAmount] = useState("100");
  const [days, setDays] = useState(String(Math.max(minDays, 7)));
  const [steps, setSteps] = useState("8000");

  const amountBase = (() => {
    try {
      const [w, f = ""] = amount.split(".");
      const frac = (f + "0".repeat(STAKE_MINT_DECIMALS)).slice(0, STAKE_MINT_DECIMALS);
      return BigInt(w || "0") * BigInt(10) ** BigInt(STAKE_MINT_DECIMALS) + BigInt(frac || "0");
    } catch {
      return 0n;
    }
  })();

  const daysN = Number(days);
  const stepsN = Number(steps);
  const problems: string[] = [];
  if (amountBase <= 0n) problems.push("Amount must be positive");
  if (amountBase >= maxStake) problems.push(`Amount must be below ${formatTokens(maxStake)}`);
  if (amountBase > balance) problems.push("Amount exceeds your balance");
  if (!Number.isInteger(daysN) || daysN < minDays || daysN > maxDays)
    problems.push(`Days must be between ${minDays} and ${maxDays}`);
  if (!Number.isInteger(stepsN) || stepsN <= 0) problems.push("Steps must be a positive number");

  return (
    <Card eyebrow="Step 3" title="Start a challenge">
      <p className="text-sm text-slate-600">
        Lock {STAKE_MINT_SYMBOL} for a number of days. Hit your step goal on{" "}
        <strong>every</strong> day and it all comes back. Miss one day and it goes to the treasury.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length === 0) onStake(amountBase, daysN, stepsN);
        }}
      >
        <Field label={`Stake (${STAKE_MINT_SYMBOL})`} value={amount} onChange={setAmount} />
        <Field label="Days" value={days} onChange={setDays} />
        <Field label="Steps per day" value={steps} onChange={setSteps} />
        <div className="sm:col-span-3">
          {problems.length > 0 ? (
            <p className="mb-3 text-xs text-red-700">{problems[0]}</p>
          ) : null}
          <Button type="submit" disabled={busy !== null || problems.length > 0}>
            {busy === "Staking" ? "Staking…" : `Stake ${amount || "0"} ${STAKE_MINT_SYMBOL}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-300 px-3 py-2 tabular-nums text-slate-950 outline-none focus:border-slate-950"
      />
    </label>
  );
}

function ActiveChallenge({
  stake,
  healthEpochDay,
  lastSteps,
  nowSec,
  todayEpochDay,
  busy,
  onSync,
  onClaim,
}: {
  stake: NonNullable<ReturnType<typeof useChallenge>["stake"]>;
  healthEpochDay: number;
  lastSteps: number;
  nowSec: number;
  todayEpochDay: number;
  busy: string | null;
  onSync: () => void;
  onClaim: () => void;
}) {
  const unlockAt = Number(stake.unlockAt);
  const unlocked = nowSec >= unlockAt;
  const won = stake.daysGoalMet >= stake.totalDays;
  const yesterday = todayEpochDay - 1;
  const yesterdaySynced = healthEpochDay >= yesterday;
  const lastCountableDay = Math.floor(unlockAt / SECONDS_PER_DAY);
  const daysRemaining = Math.max(0, Math.ceil((unlockAt - nowSec) / SECONDS_PER_DAY));

  return (
    <Card eyebrow="Active challenge" title={`${stake.daysGoalMet} of ${stake.totalDays} days met`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Staked" value={`${formatTokens(stake.stakedAmount)} ${STAKE_MINT_SYMBOL}`} />
        <Stat label="Goal" value={`${stake.goalPerDay.toLocaleString()} steps`} hint="every day" />
        <Stat
          label={unlocked ? "Unlocked" : "Unlocks"}
          value={unlocked ? "now" : `${daysRemaining}d`}
          hint={formatDate(unlockAt)}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {!unlocked ? (
          <div className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-100">
            <p className="font-semibold text-white">Daily sync</p>
            <p className="mt-1 text-slate-300">
              Each day, sync <em>yesterday&apos;s</em> steps from Google Fit. Only complete days
              count, and a day can only be attested once — so sync happens the morning after.
            </p>
            <p className="mt-2 text-slate-400">
              Last synced day: {healthEpochDay > 0 ? `epoch day ${healthEpochDay} (${lastSteps.toLocaleString()} steps)` : "none yet"}
              {yesterday > lastCountableDay ? " · challenge window has ended" : ""}
            </p>
            <div className="mt-4">
              <Button onClick={onSync} disabled={busy !== null || yesterdaySynced}>
                {busy === "Syncing steps"
                  ? "Syncing…"
                  : yesterdaySynced
                    ? "Yesterday already synced"
                    : "Sync yesterday's steps"}
              </Button>
            </div>
          </div>
        ) : null}

        {unlocked ? (
          <Notice kind={won ? "success" : "error"}>
            {won
              ? "You met the goal every day. Claim to get your stake back."
              : `You met the goal on ${stake.daysGoalMet} of ${stake.totalDays} days. Claiming forfeits the stake to the treasury and closes the challenge.`}
          </Notice>
        ) : null}

        {unlocked ? (
          <div>
            <Button onClick={onClaim} disabled={busy !== null}>
              {busy === "Claiming" ? "Claiming…" : won ? "Claim stake" : "Settle challenge"}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
