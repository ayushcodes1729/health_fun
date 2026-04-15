import { NextResponse } from "next/server";
import { createGoogleAuthorizationUrl } from "@/lib/google-fit-auth";

export async function GET() {
  try {
    const authorizationUrl = await createGoogleAuthorizationUrl();
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start Google OAuth";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
