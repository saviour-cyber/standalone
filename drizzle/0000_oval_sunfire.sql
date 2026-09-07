CREATE TYPE "public"."account_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."bet_status" AS ENUM('PLACED', 'CASHED_OUT', 'LOST', 'WON', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('DEPOSIT', 'BET_RESERVATION', 'BET_RELEASE', 'PAYOUT', 'WITHDRAWAL_RESERVATION', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL', 'REVERSAL', 'FEE', 'CHARGEBACK', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('CLEAR', 'REVIEW', 'BLOCKED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('PLAYER', 'SUPPORT', 'RISK_ANALYST', 'PAYMENTS_OPERATOR', 'COMPLIANCE_OFFICER', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('ROUND_CREATED', 'ROUND_STARTED', 'MULTIPLIER_RUNNING', 'ROUND_CRASHED', 'SETTLEMENT_PENDING', 'SETTLED');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('REQUESTED', 'ELIGIBILITY_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED', 'REVERSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" varchar(180),
	"request_id" varchar(180),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"stake_minor" numeric(20, 0) NOT NULL,
	"cash_out_multiplier" numeric(12, 4),
	"payout_minor" numeric(20, 0),
	"status" "bet_status" DEFAULT 'PLACED' NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bets_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "game_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_number" serial NOT NULL,
	"status" "round_status" DEFAULT 'ROUND_CREATED' NOT NULL,
	"commitment" text NOT NULL,
	"crash_multiplier" numeric(12, 4),
	"started_at" timestamp with time zone,
	"crashed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"amount_minor" numeric(20, 0) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reference" varchar(180) NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"provider_reference" varchar(180) NOT NULL,
	"direction" varchar(16) NOT NULL,
	"amount_minor" numeric(20, 0) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(32) NOT NULL,
	"raw_event" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_reference_unique" UNIQUE("provider_reference")
);
--> statement-breakpoint
CREATE TABLE "player_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deposit_limit_minor" numeric(20, 0),
	"wager_limit_minor" numeric(20, 0),
	"session_limit_minutes" integer,
	"cooling_off_until" timestamp with time zone,
	"self_excluded_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_controls_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "refresh_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "risk_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'OPEN' NOT NULL,
	"reason" text NOT NULL,
	"assigned_to" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"role" "role" DEFAULT 'PLAYER' NOT NULL,
	"status" "account_status" DEFAULT 'PENDING' NOT NULL,
	"kyc_status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"jurisdiction" varchar(16),
	"date_of_birth" timestamp with time zone,
	"risk_status" "risk_status" DEFAULT 'CLEAR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"currency" varchar(3) DEFAULT 'KES' NOT NULL,
	"available_minor" numeric(20, 0) DEFAULT '0' NOT NULL,
	"reserved_minor" numeric(20, 0) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_minor" numeric(20, 0) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'REQUESTED' NOT NULL,
	"provider_reference" varchar(180),
	"review_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_idempotency_idx" ON "ledger_entries" USING btree ("idempotency_key");