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
    <section className="grid gap-6 rounded-[2rem] border border-white/8 bg-white/[0.03] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
      <div className="min-w-0 space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
            Google Fit OAuth
          </p>
          <h1 className="max-w-xl font-display text-4xl font-bold italic tracking-tight text-white sm:text-5xl">
            Connect the app to Google Fit and use these routes in Google Cloud.
          </h1>
          <p className="max-w-xl text-base leading-7 text-white/60">
            This setup gives you dedicated auth endpoints for sign-in, callback,
            session checks, and logout so you can whitelist the correct origin
            and redirect URI in the OAuth client configuration.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/api/auth/google/login"
            className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-[0_0_24px_-6px_rgba(142,255,54,0.6)] transition hover:brightness-110"
          >
            Connect Google Fit
          </a>
          <button
            type="button"
            onClick={() => void handleDisconnect()}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-accent hover:text-accent"
          >
            Disconnect
          </button>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-5 text-sm text-white/80">
          <p className="font-semibold text-white">Current status</p>
          {loading ? (
            <p className="mt-2 text-white/60">Checking current session…</p>
          ) : session.connected ? (
            <div className="mt-2 space-y-2 text-white/60">
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
            <p className="mt-2 text-white/60">Not connected yet.</p>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Authorized JavaScript origin
          </p>
          <code className="mt-2 block break-all rounded-xl border border-white/8 bg-black/50 p-3 text-sm text-accent">
            {appUrl}
          </code>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Authorized redirect URI
          </p>
          <code className="mt-2 block break-all rounded-xl border border-white/8 bg-black/50 p-3 text-sm text-accent">
            {redirectUri}
          </code>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Available auth APIs
          </p>
          <div className="mt-2 space-y-2 text-sm text-white/70">
            <code className="block rounded-xl border border-white/8 bg-black/50 p-3">
              GET /api/auth/google/login
            </code>
            <code className="block rounded-xl border border-white/8 bg-black/50 p-3">
              GET /api/auth/google/callback
            </code>
            <code className="block rounded-xl border border-white/8 bg-black/50 p-3">
              GET /api/auth/session
            </code>
            <code className="block rounded-xl border border-white/8 bg-black/50 p-3">
              POST /api/auth/logout
            </code>
          </div>
        </div>
      </div>
    </section>
  );
}
