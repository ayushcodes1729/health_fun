import { NextRequest, NextResponse } from "next/server";
import {
  decodeIdTokenClaims,
  exchangeCodeForGoogleTokens,
  setGoogleSessionCookie,
  validateGoogleOauthState,
} from "@/lib/google-fit-auth";
import { upsertUserFromGoogle } from "@/lib/server/users";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const redirectUrl = new URL("/", request.url);

  if (oauthError) {
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("reason", oauthError);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  const isValidState = await validateGoogleOauthState(state);

  if (!isValidState) {
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("reason", "invalid_state");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokens = await exchangeCodeForGoogleTokens(code);
    if (!tokens.id_token) {
      throw new Error("no_id_token");
    }
    // Safe to decode without verifying the JWT: it came straight from
    // Google's token endpoint over TLS in exchange for our code.
    const identity = decodeIdTokenClaims(tokens.id_token);
    const { user, isNew } = await upsertUserFromGoogle(identity);
    await setGoogleSessionCookie(tokens, identity);

    // First sign-in with no profile yet: collect details before anything else.
    if (isNew || !user.displayName) {
      return NextResponse.redirect(new URL("/profile?onboarding=1", request.url));
    }
    redirectUrl.searchParams.set("auth", "success");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "token_exchange_failed";

    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set("reason", message);
    return NextResponse.redirect(redirectUrl);
  }
}
