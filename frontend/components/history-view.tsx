"use client";

import { useEffect, useState } from "react";

import { useAccount } from "@/hooks/use-account";
import { useChallenge } from "@/hooks/use-challenge";
import { formatDateMMDDYY, formatTokens, formatUnix } from "@/lib/format";
import { STAKE_MINT_SYMBOL } from "@/lib/solana/config";

import { Card, Notice, Stat } from "./ui";

type ChallengeRow = {
  id: string;
  stakedAmount: string;
  totalDays: number;
  goalPerDay: number;
  daysGoalMet: number;
  won: boolean;
  stakedAt: string;
  settledAt: string;
  settleSignature: string;
};

export function HistoryView() {
  const { account } = useAccount();
  const live = useChallenge();
  const [rows, setRows] = useState<ChallengeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.walletAddress) return;
    let active = true;
    fetch("/api/challenges", { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json()) as {
          challenges?: ChallengeRow[];
          backfillError?: string | null;
          error?: string;
        };
        if (!active) return;
        if (!r.ok) throw new Error(body.error ?? "Could not load history");
        setRows(body.challenges ?? []);
        if (body.backfillError) setNote(`History may be incomplete: ${body.backfillError}`);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [account?.walletAddress]);

  if (account === undefined) return null;
  if (!account) {
    return (
      <Card eyebrow="Dashboard" title="Sign in to see your history">
        <p className="text-sm text-slate-600">Your past challenges are tied to your Google account.</p>
      </Card>
    );
  }
  if (!account.walletAddress) {
    return (
      <Card eyebrow="Dashboard" title="Link a wallet first">
        <p className="text-sm text-slate-600">
          History is read from the chain for your linked wallet. Link one on the Challenge page.
        </p>
      </Card>
    );
  }

  const completed = rows?.filter((r) => r.won).length ?? 0;
  const forfeited = rows?.filter((r) => !r.won).length ?? 0;
  const totalStaked = rows?.reduce((a, r) => a + BigInt(r.stakedAmount), 0n) ?? 0n;
  const totalForfeited = rows?.filter((r) => !r.won).reduce((a, r) => a + BigInt(r.stakedAmount), 0n) ?? 0n;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {account.displayName ?? account.email}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Wallet {account.walletAddress.slice(0, 4)}…{account.walletAddress.slice(-4)}
        </p>
      </header>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {note ? <Notice kind="info">{note}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Completed" value={completed} />
        <Stat label="Forfeited" value={forfeited} />
        <Stat label="Streak" value={live.profile?.currentStreak ?? 0} hint={`best ${live.profile?.longestStreak ?? 0}`} />
        <Stat
          label="Lifetime staked"
          value={`${formatTokens(totalStaked)} ${STAKE_MINT_SYMBOL}`}
          hint={forfeited > 0 ? `${formatTokens(totalForfeited)} forfeited` : undefined}
        />
      </div>

      {live.stake ? (
        <Card eyebrow="In progress" title={`${live.stake.daysGoalMet} of ${live.stake.totalDays} days met`}>
          <p className="text-sm text-slate-600">
            {formatTokens(live.stake.stakedAmount)} {STAKE_MINT_SYMBOL} staked on{" "}
            {live.stake.goalPerDay.toLocaleString()} steps/day · unlocks {formatUnix(Number(live.stake.unlockAt))}
          </p>
        </Card>
      ) : null}

      <Card eyebrow="History" title="Past challenges">
        {rows === null && !error ? (
          <p className="text-sm text-slate-500">Loading from chain…</p>
        ) : rows && rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No settled challenges yet. Your first one will appear here after you claim it.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Staked</th>
                  <th className="py-2 pr-4">Goal</th>
                  <th className="py-2 pr-4">Result</th>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Settled</th>
                  <th className="py-2">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows?.map((r) => (
                  <tr key={r.id} className="tabular-nums">
                    <td className="py-3 pr-4 font-semibold">
                      {formatTokens(r.stakedAmount)} {STAKE_MINT_SYMBOL}
                    </td>
                    <td className="py-3 pr-4">
                      {r.goalPerDay.toLocaleString()} steps × {r.totalDays}d
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.won ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.won ? "Completed" : "Forfeited"}
                      </span>
                      <span className="ml-2 text-slate-500">
                        {r.daysGoalMet}/{r.totalDays} days
                      </span>
                    </td>
                    <td className="py-3 pr-4">{formatDateMMDDYY(new Date(r.stakedAt))}</td>
                    <td className="py-3 pr-4">{formatDateMMDDYY(new Date(r.settledAt))}</td>
                    <td className="py-3">
                      <a
                        className="text-sky-700 underline"
                        href={`https://explorer.solana.com/tx/${r.settleSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.settleSignature.slice(0, 6)}…
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
