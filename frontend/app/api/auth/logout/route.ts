import { NextResponse } from "next/server";
import { clearGoogleSessionCookie } from "@/lib/google-fit-auth";

export async function POST() {
  await clearGoogleSessionCookie();
  return NextResponse.json({ ok: true });
}
