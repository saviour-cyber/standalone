CREATE TABLE "ledger_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_code" varchar(80) NOT NULL,
	"direction" varchar(8) NOT NULL,
	"amount_minor" numeric(20, 0) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
