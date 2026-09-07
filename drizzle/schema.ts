import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "PLAYER",
  "SUPPORT",
  "RISK_ANALYST",
  "PAYMENTS_OPERATOR",
  "COMPLIANCE_OFFICER",
  "ADMIN",
  "SUPER_ADMIN",
]);
export const accountStatusEnum = pgEnum("account_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "SELF_EXCLUDED",
  "CLOSED",
]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "DEPOSIT",
  "BET_RESERVATION",
  "BET_RELEASE",
  "PAYOUT",
  "WITHDRAWAL_RESERVATION",
  "WITHDRAWAL_RELEASE",
  "WITHDRAWAL",
  "REVERSAL",
  "FEE",
  "CHARGEBACK",
  "ADJUSTMENT",
]);
export const roundStatusEnum = pgEnum("round_status", [
  "ROUND_CREATED",
  "ROUND_STARTED",
  "MULTIPLIER_RUNNING",
  "ROUND_CRASHED",
  "SETTLEMENT_PENDING",
  "SETTLED",
]);
export const betStatusEnum = pgEnum("bet_status", [
  "PLACED",
  "CASHED_OUT",
  "LOST",
  "WON",
  "VOIDED",
]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "REQUESTED",
  "ELIGIBILITY_REVIEW",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "REVERSED",
  "CANCELLED",
]);
export const riskStatusEnum = pgEnum("risk_status", [
  "CLEAR",
  "REVIEW",
  "BLOCKED",
  "RESOLVED",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  role: roleEnum("role").default("PLAYER").notNull(),
  status: accountStatusEnum("status").default("PENDING").notNull(),
  kycStatus: varchar("kyc_status", { length: 32 }).default("PENDING").notNull(),
  jurisdiction: varchar("jurisdiction", { length: 16 }),
  dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),
  riskStatus: riskStatusEnum("risk_status").default("CLEAR").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const refreshSessions = pgTable("refresh_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  availableMinor: numeric("available_minor", { precision: 20, scale: 0 })
    .default("0")
    .notNull(),
  reservedMinor: numeric("reserved_minor", { precision: 20, scale: 0 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id").notNull(),
    type: ledgerEntryTypeEnum("type").notNull(),
    amountMinor: numeric("amount_minor", { precision: 20, scale: 0 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    reference: varchar("reference", { length: 180 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    uniqueIdempotency: uniqueIndex("ledger_idempotency_idx").on(
      table.idempotencyKey
    ),
  })
);

export const gameRounds = pgTable("game_rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  roundNumber: serial("round_number").notNull(),
  status: roundStatusEnum("status").default("ROUND_CREATED").notNull(),
  commitment: text("commitment").notNull(),
  crashMultiplier: numeric("crash_multiplier", { precision: 12, scale: 4 }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  crashedAt: timestamp("crashed_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bets = pgTable("bets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  walletId: uuid("wallet_id").notNull(),
  roundId: uuid("round_id").notNull(),
  stakeMinor: numeric("stake_minor", { precision: 20, scale: 0 }).notNull(),
  cashOutMultiplier: numeric("cash_out_multiplier", {
    precision: 12,
    scale: 4,
  }),
  payoutMinor: numeric("payout_minor", { precision: 20, scale: 0 }),
  status: betStatusEnum("status").default("PLACED").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 180 })
    .notNull()
    .unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  providerReference: varchar("provider_reference", { length: 180 })
    .notNull()
    .unique(),
  direction: varchar("direction", { length: 16 }).notNull(),
  amountMinor: numeric("amount_minor", { precision: 20, scale: 0 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  rawEvent: jsonb("raw_event").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  walletId: uuid("wallet_id").notNull(),
  amountMinor: numeric("amount_minor", { precision: 20, scale: 0 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: withdrawalStatusEnum("status").default("REQUESTED").notNull(),
  providerReference: varchar("provider_reference", { length: 180 }),
  reviewReason: text("review_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const playerControls = pgTable("player_controls", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  depositLimitMinor: numeric("deposit_limit_minor", {
    precision: 20,
    scale: 0,
  }),
  wagerLimitMinor: numeric("wager_limit_minor", { precision: 20, scale: 0 }),
  sessionLimitMinutes: integer("session_limit_minutes"),
  coolingOffUntil: timestamp("cooling_off_until", { withTimezone: true }),
  selfExcludedUntil: timestamp("self_excluded_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const riskCases = pgTable("risk_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  status: varchar("status", { length: 32 }).default("OPEN").notNull(),
  reason: text("reason").notNull(),
  assignedTo: uuid("assigned_to"),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const ledgerLegs = pgTable("ledger_legs", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryId: uuid("entry_id").notNull(),
  accountCode: varchar("account_code", { length: 80 }).notNull(),
  direction: varchar("direction", { length: 8 }).notNull(),
  amountMinor: numeric("amount_minor", { precision: 20, scale: 0 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id"),
  action: varchar("action", { length: 120 }).notNull(),
  targetType: varchar("target_type", { length: 80 }).notNull(),
  targetId: varchar("target_id", { length: 180 }),
  requestId: varchar("request_id", { length: 180 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
