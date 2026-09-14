import {
  getGoogleClientId,
  getGoogleClientSecret,
  getGoogleSession,
  setGoogleSessionCookie,
} from "./google-fit-auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIT_AGGREGATE_URL =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

/**
 * Google's estimated-steps stream merges every step source the user has
 * (phone, watch) and de-duplicates overlaps. Raw per-device streams double
 * count when a user carries both.
 */
const ESTIMATED_STEPS_SOURCE =
  "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps";

/**
 * Returns a usable access token, refreshing and re-storing it when expired.
 * Returns null if the user has never connected Google Fit.
 */
async function getAccessToken(): Promise<string | null> {
  const session = await getGoogleSession();
  if (!session) return null;

  // 60s of slack so a token that expires mid-request is refreshed first.
  if (session.expiresAt > Date.now() + 60_000) {
    return session.accessToken;
  }

  if (!session.refreshToken) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const tokens = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  // Google omits refresh_token on refresh responses; keep the existing one,
  // and carry the identity claims forward unchanged.
  await setGoogleSessionCookie(
    { ...tokens, refresh_token: session.refreshToken },
    { sub: session.sub, email: session.email, name: session.name, picture: session.picture }
  );

  return tokens.access_token;
}

/**
 * Total steps for one UTC calendar day. The program numbers days as
 * `unix_timestamp / 86400`, i.e. UTC days, so the window must be UTC too —
 * a local-time window would straddle two on-chain days.
 */
export async function fetchStepsForEpochDay(
  epochDay: number
): Promise<{ steps: number } | { error: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { error: "Google Fit is not connected" };
  }

  const startTimeMillis = epochDay * 86_400_000;
  const endTimeMillis = startTimeMillis + 86_400_000;

  const res = await fetch(FIT_AGGREGATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      aggregateBy: [
        {
          dataTypeName: "com.google.step_count.delta",
          dataSourceId: ESTIMATED_STEPS_SOURCE,
        },
      ],
      bucketByTime: { durationMillis: 86_400_000 },
      startTimeMillis,
      endTimeMillis,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `Google Fit request failed (${res.status}): ${text.slice(0, 200)}` };
  }

  const body = (await res.json()) as {
    bucket?: {
      dataset?: { point?: { value?: { intVal?: number }[] }[] }[];
    }[];
  };

  let steps = 0;
  for (const bucket of body.bucket ?? []) {
    for (const dataset of bucket.dataset ?? []) {
      for (const point of dataset.point ?? []) {
        for (const value of point.value ?? []) {
          steps += value.intVal ?? 0;
        }
      }
    }
  }

  return { steps };
}
