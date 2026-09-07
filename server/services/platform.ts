import { randomUUID } from "node:crypto";
import { getUserById, listUsers, type PublicUser } from "../auth";

type LedgerEntry = {
  id: string;
  userId: string;
  type: string;
  amountMinor: number;
  currency: string;
  reference: string;
  createdAt: string;
};
type Withdrawal = {
  id: string;
  userId: string;
  amountMinor: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type Wallet = {
  userId: string;
  currency: string;
  availableMinor: number;
  reservedMinor: number;
};
type Controls = {
  depositLimitMinor: number | null;
  wagerLimitMinor: number | null;
  coolingOffUntil: string | null;
  selfExcludedUntil: string | null;
};

const wallets = new Map<string, Wallet>();
const ledger = new Map<string, LedgerEntry[]>();
const withdrawals: Withdrawal[] = [];
const controls = new Map<string, Controls>();
const audit: Array<Record<string, unknown>> = [];
const processedIdempotency = new Set<string>();
const payments: Array<{
  id: string;
  userId: string;
  provider: string;
  providerReference: string;
  direction: "DEPOSIT" | "WITHDRAWAL";
  amountMinor: number;
  status: string;
  createdAt: string;
}> = [];

export function walletFor(userId: string) {
  if (!wallets.has(userId))
    wallets.set(userId, {
      userId,
      currency: "KES",
      availableMinor: 0,
      reservedMinor: 0,
    });
  return wallets.get(userId)!;
}
export function controlsFor(userId: string) {
  if (!controls.has(userId))
    controls.set(userId, {
      depositLimitMinor: null,
      wagerLimitMinor: null,
      coolingOffUntil: null,
      selfExcludedUntil: null,
    });
  return controls.get(userId)!;
}
export function entriesFor(userId: string) {
  return ledger.get(userId) ?? [];
}
function record(
  userId: string,
  type: string,
  amountMinor: number,
  reference: string
) {
  const entry = {
    id: randomUUID(),
    userId,
    type,
    amountMinor,
    currency: "KES",
    reference,
    createdAt: new Date().toISOString(),
  };
  ledger.set(userId, [entry, ...(ledger.get(userId) ?? [])]);
  return entry;
}
export function auditLog(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {}
) {
  audit.unshift({
    id: randomUUID(),
    actorUserId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function assertProductionEligible(userId: string) {
  if (process.env.REAL_MONEY_ENABLED !== "true") return;
  const user = getUserById(userId);
  const age = user?.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(user.dateOfBirth).getTime()) / 31557600000
      )
    : 0;
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.kycStatus !== "VERIFIED" ||
    !user.jurisdiction ||
    user.riskStatus !== "CLEAR" ||
    !user.dateOfBirth ||
    age < 18
  )
    throw new Error("Player is not eligible for production wagering");
}

export function demoDeposit(
  userId: string,
  amountMinor: number,
  idempotencyKey: string
) {
  if (processedIdempotency.has(idempotencyKey))
    return {
      duplicate: true,
      wallet: walletFor(userId),
      entry: entriesFor(userId)[0],
    };
  assertProductionEligible(userId);
  const playerControls = controlsFor(userId);
  if (
    playerControls.depositLimitMinor !== null &&
    amountMinor > playerControls.depositLimitMinor
  )
    throw new Error("Deposit limit exceeded");
  if (
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > 5_000_000
  )
    throw new Error("Deposit amount is outside the sandbox limits");
  const wallet = walletFor(userId);
  wallet.availableMinor += amountMinor;
  processedIdempotency.add(idempotencyKey);
  const entry = record(
    userId,
    "DEPOSIT",
    amountMinor,
    `mock-deposit:${idempotencyKey}`
  );
  payments.unshift({
    id: randomUUID(),
    userId,
    provider: "mock",
    providerReference: `mock-deposit-${idempotencyKey}`,
    direction: "DEPOSIT",
    amountMinor,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
  });
  return { duplicate: false, wallet, entry };
}

export function requestWithdrawal(userId: string, amountMinor: number) {
  assertProductionEligible(userId);
  const wallet = walletFor(userId);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0)
    throw new Error("Withdrawal amount is invalid");
  if (amountMinor > wallet.availableMinor)
    throw new Error("Insufficient available balance");
  wallet.availableMinor -= amountMinor;
  wallet.reservedMinor += amountMinor;
  const now = new Date().toISOString();
  const withdrawal = {
    id: randomUUID(),
    userId,
    amountMinor,
    status: "ELIGIBILITY_REVIEW",
    createdAt: now,
    updatedAt: now,
  };
  withdrawals.unshift(withdrawal);
  record(userId, "WITHDRAWAL_RESERVATION", amountMinor, withdrawal.id);
  return withdrawal;
}

export function setControls(userId: string, patch: Partial<Controls>) {
  const next = { ...controlsFor(userId), ...patch };
  controls.set(userId, next);
  return next;
}
export function allWithdrawals() {
  return withdrawals;
}
export function allAudit() {
  return audit;
}
export function overview() {
  return {
    users: listUsers().length,
    activeRounds: 1,
    pendingWithdrawals: withdrawals.filter(item =>
      ["REQUESTED", "ELIGIBILITY_REVIEW", "PROCESSING"].includes(item.status)
    ).length,
    ledgerEntries: Array.from(ledger.values()).reduce(
      (count, items) => count + items.length,
      0
    ),
    sandboxMode: process.env.REAL_MONEY_ENABLED !== "true",
  };
}
export function userSummary(user: PublicUser) {
  return {
    user,
    wallet: walletFor(user.id),
    controls: controlsFor(user.id),
    ledger: entriesFor(user.id),
    withdrawals: withdrawals.filter(item => item.userId === user.id),
  };
}

type BetRecord = {
  id: string;
  userId: string;
  roundId: string;
  stakeMinor: number;
  status: "PLACED" | "CASHED_OUT" | "LOST";
  payoutMinor: number;
  createdAt: string;
};
const bets: BetRecord[] = [];
export function placeBet(userId: string, roundId: string, stakeMinor: number) {
  assertProductionEligible(userId);
  const wallet = walletFor(userId);
  if (!Number.isInteger(stakeMinor) || stakeMinor <= 0)
    throw new Error("Stake must be a positive integer amount in minor units");
  const controls = controlsFor(userId);
  if (
    controls.wagerLimitMinor !== null &&
    stakeMinor > controls.wagerLimitMinor
  )
    throw new Error("Wager limit exceeded");
  if (
    controls.coolingOffUntil &&
    new Date(controls.coolingOffUntil).getTime() > Date.now()
  )
    throw new Error("Cooling-off period is active");
  if (
    controls.selfExcludedUntil &&
    new Date(controls.selfExcludedUntil).getTime() > Date.now()
  )
    throw new Error("Self-exclusion is active");
  if (stakeMinor > wallet.availableMinor)
    throw new Error("Insufficient available balance");
  wallet.availableMinor -= stakeMinor;
  wallet.reservedMinor += stakeMinor;
  const bet = {
    id: randomUUID(),
    userId,
    roundId,
    stakeMinor,
    status: "PLACED" as const,
    payoutMinor: 0,
    createdAt: new Date().toISOString(),
  };
  bets.unshift(bet);
  record(userId, "BET_RESERVATION", stakeMinor, bet.id);
  return bet;
}
export function listBets(userId?: string) {
  return userId ? bets.filter(bet => bet.userId === userId) : bets;
}
export function cashOutBet(
  userId: string,
  betId: string,
  roundId: string,
  multiplier: number
) {
  const bet = bets.find(
    item =>
      item.id === betId && item.userId === userId && item.roundId === roundId
  );
  if (!bet || bet.status !== "PLACED")
    throw new Error("Bet is no longer eligible for cash-out");
  const payoutMinor = Math.floor(bet.stakeMinor * multiplier);
  const wallet = walletFor(userId);
  wallet.reservedMinor -= bet.stakeMinor;
  wallet.availableMinor += payoutMinor;
  bet.status = "CASHED_OUT";
  bet.payoutMinor = payoutMinor;
  record(userId, "PAYOUT", payoutMinor, bet.id);
  return bet;
}

export function allWallets() {
  return Array.from(wallets.values());
}
export function allLedgerEntries() {
  return Array.from(ledger.values()).flat();
}
export function allPayments() {
  return payments;
}
export function allBets() {
  return bets;
}
export function riskQueue() {
  return listUsers()
    .filter(
      user => user.riskStatus !== "CLEAR" || user.kycStatus !== "VERIFIED"
    )
    .map(user => ({
      userId: user.id,
      email: user.email,
      riskStatus: user.riskStatus,
      kycStatus: user.kycStatus,
    }));
}
