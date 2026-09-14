import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getCurrentUser, validateProfilePatch } from "@/lib/server/users";

function publicUser(u: schema.User) {
  // Never expose googleSub; it is the identity key.
  const { googleSub: _sub, ...rest } = u;
  void _sub;
  return rest;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: publicUser(user) });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const patch = validateProfilePatch(await request.json().catch(() => null));
  if ("error" in patch) return NextResponse.json({ error: patch.error }, { status: 400 });

  const [updated] = await db
    .update(schema.users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .returning();
  return NextResponse.json({ user: publicUser(updated) });
}
