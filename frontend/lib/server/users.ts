import "server-only";

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getGoogleSession } from "@/lib/google-fit-auth";

export async function upsertUserFromGoogle(identity: {
  sub: string;
  email: string;
  name?: string;
}): Promise<{ user: schema.User; isNew: boolean }> {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.googleSub, identity.sub),
  });
  if (existing) {
    if (existing.email !== identity.email) {
      await db
        .update(schema.users)
        .set({ email: identity.email, updatedAt: new Date() })
        .where(eq(schema.users.id, existing.id));
    }
    return { user: existing, isNew: false };
  }

  const [created] = await db
    .insert(schema.users)
    .values({ googleSub: identity.sub, email: identity.email })
    .returning();
  return { user: created, isNew: true };
}

/** The signed-in user, or null. Trusts only the HMAC-verified cookie. */
export async function getCurrentUser(): Promise<schema.User | null> {
  const session = await getGoogleSession();
  if (!session?.sub) return null;
  return (
    (await db.query.users.findFirst({
      where: eq(schema.users.googleSub, session.sub),
    })) ?? null
  );
}

/** Fields a user may edit about themselves. Everything else is system-owned. */
export type ProfilePatch = Partial<
  Pick<schema.User, "displayName" | "age" | "heightCm" | "weightKg" | "bio">
>;

export function validateProfilePatch(input: unknown): ProfilePatch | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid body" };
  const b = input as Record<string, unknown>;
  const out: ProfilePatch = {};

  if ("displayName" in b) {
    if (typeof b.displayName !== "string" || b.displayName.trim().length === 0 || b.displayName.length > 60)
      return { error: "Display name must be 1–60 characters" };
    out.displayName = b.displayName.trim();
  }
  const intField = (key: "age" | "heightCm" | "weightKg", min: number, max: number, label: string) => {
    if (!(key in b)) return null;
    if (b[key] === null || b[key] === "") { out[key] = null; return null; }
    const n = Number(b[key]);
    if (!Number.isInteger(n) || n < min || n > max) return `${label} must be a whole number between ${min} and ${max}`;
    out[key] = n;
    return null;
  };
  const e =
    intField("age", 13, 120, "Age") ??
    intField("heightCm", 50, 272, "Height (cm)") ??
    intField("weightKg", 20, 500, "Weight (kg)");
  if (e) return { error: e };
  if ("bio" in b) {
    if (b.bio !== null && (typeof b.bio !== "string" || b.bio.length > 280))
      return { error: "Bio must be at most 280 characters" };
    out.bio = b.bio === null ? null : (b.bio as string).trim() || null;
  }
  return out;
}
