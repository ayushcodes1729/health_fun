"use client";

import { useEffect, useState } from "react";

type SessionResponse = {
  connected: boolean;
  expiresAt: number | null;
  scopes: string[];
};

const DEFAULT_SESSION: SessionResponse = {
  connected: false,
  expiresAt: null,
  scopes: [],
};

type ConnectionCardProps = {
  appUrl: string;
  redirectUri: string;
};

export function GoogleFitConnectionCard({
  appUrl,
  redirectUri,
}: ConnectionCardProps) {
  const [session, setSession] = useState<SessionResponse>(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const data = (await response.json()) as SessionResponse;

        if (active) {
          setSession(data);
        }
      } catch {
        if (active) {
          setSession(DEFAULT_SESSION);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleDisconnect() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setSession(DEFAULT_SESSION);
  }

  return (
    <section className="grid gap-6 rounded-[2rem] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Google Fit OAuth
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Connect the app to Google Fit and use these routes in Google Cloud.
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-600">
            This setup gives you dedicated auth endpoints for sign-in, callback,
            session checks, and logout so you can whitelist the correct origin
            and redirect URI in the OAuth client configuration.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/api/auth/google/login"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Connect Google Fit
          </a>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
          >
            Disconnect
          </button>
        </div>

        <div className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-100">
          <p className="font-semibold text-white">Current status</p>
          {loading ? (
            <p className="mt-2 text-slate-300">Checking current session…</p>
          ) : session.connected ? (
            <div className="mt-2 space-y-2 text-slate-300">
              <p>Connected</p>
              <p>
                Token expiry:{" "}
                {session.expiresAt
                  ? new Date(session.expiresAt).toLocaleString()
                  : "Unavailable"}
              </p>
              <p>Granted scopes: {session.scopes.join(", ")}</p>
            </div>
          ) : (
            <p className="mt-2 text-slate-300">Not connected yet.</p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-[1.5rem] bg-slate-50 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Authorized JavaScript origin
          </p>
          <code className="mt-2 block overflow-x-auto rounded-xl bg-white p-3 text-sm text-slate-900">
            {appUrl}
          </code>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Authorized redirect URI
          </p>
          <code className="mt-2 block overflow-x-auto rounded-xl bg-white p-3 text-sm text-slate-900">
            {redirectUri}
          </code>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Available auth APIs
          </p>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <code className="block rounded-xl bg-white p-3">
              GET /api/auth/google/login
            </code>
            <code className="block rounded-xl bg-white p-3">
              GET /api/auth/google/callback
            </code>
            <code className="block rounded-xl bg-white p-3">
              GET /api/auth/session
            </code>
            <code className="block rounded-xl bg-white p-3">
              POST /api/auth/logout
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
