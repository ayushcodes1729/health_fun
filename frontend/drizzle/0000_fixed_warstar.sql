CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"wallet_address" text NOT NULL,
	"mint" text NOT NULL,
	"staked_amount" bigint NOT NULL,
	"total_days" integer NOT NULL,
	"goal_per_day" integer NOT NULL,
	"days_goal_met" integer NOT NULL,
	"won" boolean NOT NULL,
	"staked_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"settle_signature" text NOT NULL,
	"slot" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_settle_signature_unique" UNIQUE("settle_signature")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"age" integer,
	"height_cm" integer,
	"weight_kg" integer,
	"bio" text,
	"wallet_address" text,
	"wallet_linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub"),
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;