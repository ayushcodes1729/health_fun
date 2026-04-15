import { NextResponse } from "next/server";
import { getGoogleConnectionSummary } from "@/lib/google-fit-auth";

export async function GET() {
  const session = await getGoogleConnectionSummary();
  return NextResponse.json(session);
}
