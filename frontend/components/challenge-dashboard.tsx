"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { useAccount } from "@/hooks/use-account";
import { useActions, type StepsPreview } from "@/hooks/use-actions";
import { useChallenge } from "@/hooks/use-challenge";
import { formatEpochDay, formatTokens, formatUnix } from "@/lib/format";
import {
  SECONDS_PER_DAY,
  STAKE_MINT_DECIMALS,
  STAKE_MINT_SYMBOL,
} from "@/lib/solana/config";

import { AuthNotice } from "./auth-notice";
import { Button, Card, Notice, Stat } from "./ui";

export function ChallengeDashboard() {
  const { publicKey } = useWallet();
  const challenge = useChallenge();
  const actions = useActions(challenge.refresh);
  const acct = useAccount();

  const nowSec = Math.floor(Date.now() / 1000);
  const todayEpochDay = Math.floor(nowSec / SECONDS_PER_DAY);

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
          Move-to-earn, on-chain
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold italic tracking-tight text-white sm:text-5xl">
          Stake on your steps. Hit the goal every day or forfeit.
        </h1>
      </header>

      <AuthNotice />
      {acct.error ? <Notice kind="error">{acct.error}</Notice> : null}

      {actions.error ? <Notice kind="error">{actions.error}</Notice> : null}
      {challenge.error ? <Notice kind="error">{challenge.error}</Notice> : null}
      {actions.lastSignature ? (
        <Notice kind="success">
          {actions.lastMessage ? `${actions.lastMessage} · ` : ""}Confirmed:{" "}
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
          <p className="text-sm text-white/60">
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

      {publicKey && acct.account && acct.account.walletAddress !== publicKey.toBase58() ? (
        <Card eyebrow="Account" title="Link this wallet to your account">
          <p className="text-sm text-white/60">
            {acct.account.walletAddress
              ? `Your account is linked to ${acct.account.walletAddress.slice(0, 4)}…${acct.account.walletAddress.slice(-4)}. Link this wallet instead, or switch wallets.`
              : "Sign a message to prove you control this wallet. Step syncs are only issued for your linked wallet."}
          </p>
          <div className="mt-4">
            <Button onClick={() => void acct.linkWallet()} disabled={acct.busy !== null}>
              {acct.busy === "Linking wallet" ? "Check your wallet…" : "Link wallet"}
            </Button>
          </div>
        </Card>
      ) : null}

      {publicKey && !acct.account && acct.account !== undefined ? (
        <Notice kind="info">
          Sign in with Google (top right) to link this wallet and sync steps from Google Fit.
        </Notice>
      ) : null}

      {publicKey && (challenge.tokenBalance === null || challenge.tokenBalance === 0n) ? (
        <Card eyebrow="Devnet" title="Get test tokens">
          <p className="text-sm text-white/60">
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
          <p className="text-sm text-white/60">
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
          previewSteps={actions.previewSteps}
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
      <p className="text-sm text-white/60">
        Lock {STAKE_MINT_SYMBOL} for a number of days. Hit your step goal on{" "}
        <strong className="text-white">every</strong> day and it all comes back. Miss one day and it goes to the treasury.
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
            <p className="mb-3 text-xs text-red-400">{problems[0]}</p>
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
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 tabular-nums text-white outline-none focus:border-accent"
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
  previewSteps,
  onSync,
  onClaim,
}: {
  stake: NonNullable<ReturnType<typeof useChallenge>["stake"]>;
  healthEpochDay: number;
  lastSteps: number;
  nowSec: number;
  todayEpochDay: number;
  busy: string | null;
  previewSteps: () => Promise<StepsPreview | { error: string }>;
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

  // What Google Fit reports for yesterday. Shown before the user commits,
  // because an attested day can never be re-attested.
  const [preview, setPreview] = useState<StepsPreview | { error: string } | null>(null);
  useEffect(() => {
    if (unlocked || yesterdaySynced) return;
    let active = true;
    setPreview(null);
    void previewSteps().then((p) => {
      if (active) setPreview(p);
    });
    return () => {
      active = false;
    };
  }, [previewSteps, unlocked, yesterdaySynced, healthEpochDay]);

  const previewSteps_ = preview && !("error" in preview) ? preview.steps : null;
  const goalMet = previewSteps_ !== null && previewSteps_ >= stake.goalPerDay;

  const confirmAndSync = () => {
    if (previewSteps_ !== null && !goalMet) {
      const ok = window.confirm(
        `Google Fit reports ${previewSteps_.toLocaleString()} steps for yesterday, below your ${stake.goalPerDay.toLocaleString()}-step goal. ` +
          `Syncing will record this day as missed and the challenge cannot be won. ` +
          `If Google Fit hasn't finished syncing from your phone, wait and try later. Sync anyway?`
      );
      if (!ok) return;
    }
    onSync();
  };

  return (
    <Card eyebrow="Active challenge" title={`${stake.daysGoalMet} of ${stake.totalDays} days met`}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Staked" value={`${formatTokens(stake.stakedAmount)} ${STAKE_MINT_SYMBOL}`} />
        <Stat label="Goal" value={`${stake.goalPerDay.toLocaleString()} steps`} hint="every day" />
        <Stat
          label={unlocked ? "Unlocked" : "Unlocks"}
          value={unlocked ? "now" : `${daysRemaining}d`}
          hint={formatUnix(unlockAt)}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {!unlocked ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-5 text-sm text-white/80">
            <p className="font-semibold text-white">Daily sync</p>
            <p className="mt-1 text-white/60">
              Each day, sync <em>yesterday&apos;s</em> steps from Google Fit. Only complete days
              count, and a day can only be attested once — so sync happens the morning after.
            </p>
            <p className="mt-2 text-white/40">
              Last synced day: {healthEpochDay > 0 ? `${formatEpochDay(healthEpochDay)} (${lastSteps.toLocaleString()} steps)` : "none yet"}
              {yesterday > lastCountableDay ? " · challenge window has ended" : ""}
            </p>
            {!yesterdaySynced ? (
              <div className="mt-3 rounded-xl border border-white/8 bg-black/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Google Fit · yesterday (UTC)
                </p>
                {preview === null ? (
                  <p className="mt-1 text-white/60">Checking…</p>
                ) : "error" in preview ? (
                  <p className="mt-1 text-amber-300">{preview.error}</p>
                ) : (
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${goalMet ? "text-accent" : "text-amber-300"}`}>
                    {preview.steps.toLocaleString()} steps
                    <span className="ml-2 text-sm font-normal text-white/50">
                      {goalMet ? "· goal met" : `· below ${stake.goalPerDay.toLocaleString()}`}
                    </span>
                  </p>
                )}
              </div>
            ) : null}
            <div className="mt-4">
              <Button onClick={confirmAndSync} disabled={busy !== null || yesterdaySynced || preview === null || "error" in preview}>
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

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onClaim} disabled={busy !== null || !unlocked}>
            {busy === "Claiming" ? "Claiming…" : unlocked ? (won ? "Claim stake" : "Settle challenge") : "Claim"}
          </Button>
          {!unlocked ? (
            <span className="text-sm text-white/40">
              Available {formatUnix(unlockAt)} · {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
