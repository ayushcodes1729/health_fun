import { cookies, headers } from "next/headers";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

type StoredGoogleSession = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  idToken?: string;
  scope: string;
  tokenType: string;
};

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

export async function setGoogleSessionCookie(tokens: GoogleTokenResponse) {
  const cookieStore = await cookies();
  const session: StoredGoogleSession = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    scope: tokens.scope,
    tokenType: tokens.token_type,
  };

  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
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

  try {
    return JSON.parse(rawSession) as StoredGoogleSession;
  } catch {
    return null;
  }
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
