import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForGoogleTokens,
  setGoogleSessionCookie,
  validateGoogleOauthState,
} from "@/lib/google-fit-auth";

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
    await setGoogleSessionCookie(tokens);
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
