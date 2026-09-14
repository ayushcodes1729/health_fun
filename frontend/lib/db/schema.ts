import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Off-chain state. Two things live here that have no on-chain home:
 *
 * 1. Who the user is. Identity is the Google account (`googleSub`), because
 *    that is what the oracle already trusts for health data. A wallet is
 *    LINKED to that identity by signing a message, which is what lets the
 *    oracle refuse to attest steps to a wallet the signed-in user doesn't
 *    control.
 * 2. Challenge history. The program closes each StakeAccount on claim to
 *    return rent, so per-challenge detail survives only as a
 *    ChallengeSettled event in transaction logs — which RPC nodes prune.
 *    This table is a durable cache of those events, back-filled from chain
 *    on demand. The chain is the source of truth; this is never written from
 *    user input.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email").notNull(),
  /** Profile fields, collected at onboarding and editable at /profile. */
  displayName: text("display_name"),
  age: integer("age"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  bio: text("bio"),
  /** Base58 wallet address proven by signature; one wallet per account. */
  walletAddress: text("wallet_address").unique(),
  walletLinkedAt: timestamp("wallet_linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  walletAddress: text("wallet_address").notNull(),
  mint: text("mint").notNull(),
  /** Base units of the mint (u64 on-chain). */
  stakedAmount: bigint("staked_amount", { mode: "bigint" }).notNull(),
  totalDays: integer("total_days").notNull(),
  goalPerDay: integer("goal_per_day").notNull(),
  daysGoalMet: integer("days_goal_met").notNull(),
  won: boolean("won").notNull(),
  stakedAt: timestamp("staked_at", { withTimezone: true }).notNull(),
  settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),
  /** The claim transaction; natural key, so back-fill is idempotent. */
  settleSignature: text("settle_signature").notNull().unique(),
  slot: bigint("slot", { mode: "bigint" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
