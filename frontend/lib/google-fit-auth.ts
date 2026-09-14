import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

export type StoredGoogleSession = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  idToken?: string;
  scope: string;
  tokenType: string;
  /** Google account id — the user's identity across the app. */
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

/**
 * The cookie is HMAC-signed. It carries the user's identity (`sub`), so an
 * unsigned cookie would let anyone forge a session for any account: edit
 * their profile, or have the oracle attest steps to their wallet.
 */
function sessionSecret(): Buffer {
  const raw = getRequiredEnv("SESSION_SECRET");
  if (raw.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return Buffer.from(raw);
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(session: StoredGoogleSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw: string): StoredGoogleSession | null {
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  const expected = sign(payload);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Claims from Google's id_token. Only trusted straight from the token endpoint. */
export function decodeIdTokenClaims(idToken: string): {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
} {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!claims.sub || !claims.email) throw new Error("id_token missing sub/email");
  return { sub: claims.sub, email: claims.email, name: claims.name, picture: claims.picture };
}

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SESSION_COOKIE_NAME = "google_fit_session";
const STATE_COOKIE_NAME = "google_fit_oauth_state";

export const GOOGLE_FIT_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
];

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function getBaseUrl() {
  const configuredBaseUrl =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Unable to determine application URL. Set APP_URL.");
  }

  return `${protocol}://${host}`;
}

export async function getGoogleRedirectUri() {
  const baseUrl = await getBaseUrl();
  return `${baseUrl}/api/auth/google/callback`;
}

export function getGoogleClientId() {
  return getRequiredEnv("GOOGLE_CLIENT_ID");
}

export function getGoogleClientSecret() {
  return getRequiredEnv("GOOGLE_CLIENT_SECRET");
}

export async function createGoogleAuthorizationUrl() {
  const state = crypto.randomUUID();
  const redirectUri = await getGoogleRedirectUri();
  const cookieStore = await cookies();

  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_FIT_SCOPES.join(" "),
    state,
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function validateGoogleOauthState(receivedState: string | null) {
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  cookieStore.delete(STATE_COOKIE_NAME);

  return Boolean(receivedState && expectedState && receivedState === expectedState);
}

export async function exchangeCodeForGoogleTokens(code: string) {
  const redirectUri = await getGoogleRedirectUri();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token exchange failed: ${errorBody}`);
  }

  const tokens = (await response.json()) as GoogleTokenResponse;
  return tokens;
}

export async function setGoogleSessionCookie(
  tokens: GoogleTokenResponse,
  identity: { sub: string; email: string; name?: string; picture?: string }
) {
  const cookieStore = await cookies();
  const session: StoredGoogleSession = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    scope: tokens.scope,
    tokenType: tokens.token_type,
    ...identity,
  };

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearGoogleSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getGoogleSession() {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawSession) {
    return null;
  }

  return decodeSession(rawSession);
}

export async function getGoogleConnectionSummary() {
  const session = await getGoogleSession();

  if (!session) {
    return {
      connected: false,
      expiresAt: null,
      scopes: [],
    };
  }

  return {
    connected: session.expiresAt > Date.now(),
    expiresAt: session.expiresAt,
    scopes: session.scope.split(" "),
  };
}
