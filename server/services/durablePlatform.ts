import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";

type Client = {
  query: <T = any>(
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
};

export async function durableDeposit(input: {
  userId: string;
  amountMinor: number;
  idempotencyKey: string;
}) {
  return withTransaction(async (client: Client) => {
    const duplicate = await client.query<{ id: string }>(
      "SELECT id FROM payments WHERE provider_reference = $1 LIMIT 1",
      [input.idempotencyKey]
    );
    if (duplicate.rows[0]) return { duplicate: true, id: duplicate.rows[0].id };
    const wallet = await client.query<{ id: string }>(
      "SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE",
      [input.userId]
    );
    if (!wallet.rows[0]) throw new Error("Wallet not found");
    const paymentId = randomUUID();
    await client.query(
      "INSERT INTO payments (id, user_id, provider, provider_reference, direction, amount_minor, currency, status, raw_event) VALUES ($1, $2, 'production-adapter', $3, 'DEPOSIT', $4, 'KES', 'COMPLETED', '{}'::jsonb)",
      [paymentId, input.userId, input.idempotencyKey, input.amountMinor]
    );
    await client.query(
      "UPDATE wallets SET available_minor = available_minor + $1, updated_at = NOW() WHERE id = $2",
      [input.amountMinor, wallet.rows[0].id]
    );
    await balancedEntry(client, {
      walletId: wallet.rows[0].id,
      type: "DEPOSIT",
      amountMinor: input.amountMinor,
      reference: paymentId,
      idempotencyKey: `deposit:${input.idempotencyKey}`,
      walletDirection: "DEBIT",
    });
    return { duplicate: false, id: paymentId };
  });
}

export async function durablePlaceBet(input: {
  userId: string;
  roundId: string;
  stakeMinor: number;
  idempotencyKey: string;
}) {
  return withTransaction(async (client: Client) => {
    const duplicate = await client.query<{ id: string }>(
      "SELECT id FROM bets WHERE idempotency_key = $1 LIMIT 1",
      [input.idempotencyKey]
    );
    if (duplicate.rows[0]) return { duplicate: true, id: duplicate.rows[0].id };
    const wallet = await client.query<{ id: string; available_minor: string }>(
      "SELECT id, available_minor FROM wallets WHERE user_id = $1 FOR UPDATE",
      [input.userId]
    );
    if (
      !wallet.rows[0] ||
      Number(wallet.rows[0].available_minor) < input.stakeMinor
    )
      throw new Error("Insufficient available balance");
    const betId = randomUUID();
    await client.query(
      "UPDATE wallets SET available_minor = available_minor - $1, reserved_minor = reserved_minor + $1, updated_at = NOW() WHERE id = $2",
      [input.stakeMinor, wallet.rows[0].id]
    );
    await client.query(
      "INSERT INTO bets (id, user_id, wallet_id, round_id, stake_minor, status, idempotency_key) VALUES ($1, $2, $3, $4, $5, 'PLACED', $6)",
      [
        betId,
        input.userId,
        wallet.rows[0].id,
        input.roundId,
        input.stakeMinor,
        input.idempotencyKey,
      ]
    );
    await balancedEntry(client, {
      walletId: wallet.rows[0].id,
      type: "BET_RESERVATION",
      amountMinor: input.stakeMinor,
      reference: betId,
      idempotencyKey: `bet:${input.idempotencyKey}`,
      walletDirection: "CREDIT",
    });
    return { duplicate: false, id: betId };
  });
}

export async function durableCashOut(input: {
  userId: string;
  betId: string;
  roundId: string;
  multiplier: number;
}) {
  return withTransaction(async (client: Client) => {
    const bet = await client.query<{
      wallet_id: string;
      stake_minor: string;
      status: string;
    }>(
      "SELECT wallet_id, stake_minor, status FROM bets WHERE id = $1 AND user_id = $2 AND round_id = $3 FOR UPDATE",
      [input.betId, input.userId, input.roundId]
    );
    if (!bet.rows[0] || bet.rows[0].status !== "PLACED")
      throw new Error("Bet is no longer eligible for cash-out");
    const payout = Math.floor(
      Number(bet.rows[0].stake_minor) * input.multiplier
    );
    await client.query(
      "UPDATE wallets SET reserved_minor = reserved_minor - $1, available_minor = available_minor + $2, updated_at = NOW() WHERE id = $3",
      [Number(bet.rows[0].stake_minor), payout, bet.rows[0].wallet_id]
    );
    await client.query(
      "UPDATE bets SET status = 'CASHED_OUT', cash_out_multiplier = $1, payout_minor = $2 WHERE id = $3",
      [input.multiplier, payout, input.betId]
    );
    await balancedEntry(client, {
      walletId: bet.rows[0].wallet_id,
      type: "PAYOUT",
      amountMinor: payout,
      reference: input.betId,
      idempotencyKey: `payout:${input.betId}`,
      walletDirection: "DEBIT",
    });
    return { id: input.betId, payoutMinor: payout, status: "CASHED_OUT" };
  });
}

export async function durableWithdrawal(input: {
  userId: string;
  amountMinor: number;
}) {
  return withTransaction(async (client: Client) => {
    const wallet = await client.query<{ id: string; available_minor: string }>(
      "SELECT id, available_minor FROM wallets WHERE user_id = $1 FOR UPDATE",
      [input.userId]
    );
    if (
      !wallet.rows[0] ||
      Number(wallet.rows[0].available_minor) < input.amountMinor
    )
      throw new Error("Insufficient available balance");
    const id = randomUUID();
    await client.query(
      "UPDATE wallets SET available_minor = available_minor - $1, reserved_minor = reserved_minor + $1, updated_at = NOW() WHERE id = $2",
      [input.amountMinor, wallet.rows[0].id]
    );
    await client.query(
      "INSERT INTO withdrawals (id, user_id, wallet_id, amount_minor, currency, status) VALUES ($1, $2, $3, $4, 'KES', 'ELIGIBILITY_REVIEW')",
      [id, input.userId, wallet.rows[0].id, input.amountMinor]
    );
    await balancedEntry(client, {
      walletId: wallet.rows[0].id,
      type: "WITHDRAWAL_RESERVATION",
      amountMinor: input.amountMinor,
      reference: id,
      idempotencyKey: `withdrawal:${id}`,
      walletDirection: "CREDIT",
    });
    return { id, status: "ELIGIBILITY_REVIEW", amountMinor: input.amountMinor };
  });
}

export async function durableTransitionWithdrawal(input: {
  withdrawalId: string;
  nextStatus:
    | "APPROVED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "REJECTED"
    | "REVERSED";
  reason?: string;
}) {
  return withTransaction(async (client: Client) => {
    const result = await client.query<{
      id: string;
      wallet_id: string;
      amount_minor: string;
      status: string;
    }>(
      "SELECT id, wallet_id, amount_minor, status FROM withdrawals WHERE id = $1 FOR UPDATE",
      [input.withdrawalId]
    );
    const withdrawal = result.rows[0];
    if (!withdrawal) throw new Error("Withdrawal not found");
    const allowed: Record<string, string[]> = {
      ELIGIBILITY_REVIEW: ["APPROVED", "REJECTED"],
      APPROVED: ["PROCESSING", "REJECTED"],
      PROCESSING: ["COMPLETED", "FAILED"],
      FAILED: ["REVERSED"],
      REJECTED: ["REVERSED"],
    };
    if (!allowed[withdrawal.status]?.includes(input.nextStatus))
      throw new Error(
        `Invalid withdrawal transition ${withdrawal.status} -> ${input.nextStatus}`
      );
    if (
      ["COMPLETED", "FAILED", "REJECTED", "REVERSED"].includes(input.nextStatus)
    )
      await client.query(
        "UPDATE wallets SET reserved_minor = reserved_minor - $1, available_minor = CASE WHEN $2 IN ('FAILED','REJECTED','REVERSED') THEN available_minor + $1 ELSE available_minor END, updated_at = NOW() WHERE id = $3",
        [
          Number(withdrawal.amount_minor),
          input.nextStatus,
          withdrawal.wallet_id,
        ]
      );
    await client.query(
      "UPDATE withdrawals SET status = $1, review_reason = $2, updated_at = NOW() WHERE id = $3",
      [input.nextStatus, input.reason || null, input.withdrawalId]
    );
    if (input.nextStatus === "COMPLETED")
      await balancedEntry(client, {
        walletId: withdrawal.wallet_id,
        type: "WITHDRAWAL",
        amountMinor: Number(withdrawal.amount_minor),
        reference: input.withdrawalId,
        idempotencyKey: `withdrawal-complete:${input.withdrawalId}`,
        walletDirection: "CREDIT",
      });
    if (["FAILED", "REJECTED", "REVERSED"].includes(input.nextStatus))
      await balancedEntry(client, {
        walletId: withdrawal.wallet_id,
        type: "REVERSAL",
        amountMinor: Number(withdrawal.amount_minor),
        reference: input.withdrawalId,
        idempotencyKey: `withdrawal-reversal:${input.withdrawalId}:${input.nextStatus}`,
        walletDirection: "DEBIT",
      });
    return { id: input.withdrawalId, status: input.nextStatus };
  });
}

export async function durableSettleRound(roundId: string) {
  return withTransaction(async (client: Client) => {
    const placed = await client.query<{
      id: string;
      wallet_id: string;
      stake_minor: string;
    }>(
      "SELECT id, wallet_id, stake_minor FROM bets WHERE round_id = $1 AND status = 'PLACED' FOR UPDATE",
      [roundId]
    );
    for (const bet of placed.rows) {
      await client.query("UPDATE bets SET status = 'LOST' WHERE id = $1", [
        bet.id,
      ]);
      await client.query(
        "UPDATE wallets SET reserved_minor = reserved_minor - $1, updated_at = NOW() WHERE id = $2",
        [Number(bet.stake_minor), bet.wallet_id]
      );
      await balancedEntry(client, {
        walletId: bet.wallet_id,
        type: "BET_RELEASE",
        amountMinor: Number(bet.stake_minor),
        reference: bet.id,
        idempotencyKey: `settlement:${roundId}:${bet.id}`,
        walletDirection: "DEBIT",
      });
    }
    return { roundId, settledBets: placed.rows.length };
  });
}

async function balancedEntry(
  client: Client,
  input: {
    walletId: string;
    type: string;
    amountMinor: number;
    reference: string;
    idempotencyKey: string;
    walletDirection: "DEBIT" | "CREDIT";
  }
) {
  const entryId = randomUUID();
  const opposite = input.walletDirection === "DEBIT" ? "CREDIT" : "DEBIT";
  await client.query(
    "INSERT INTO ledger_entries (id, wallet_id, type, amount_minor, currency, reference, idempotency_key, metadata) VALUES ($1, $2, $3, $4, 'KES', $5, $6, '{}'::jsonb)",
    [
      entryId,
      input.walletId,
      input.type,
      input.amountMinor,
      input.reference,
      input.idempotencyKey,
    ]
  );
  await client.query(
    "INSERT INTO ledger_legs (id, entry_id, account_code, direction, amount_minor, currency) VALUES ($1, $2, $3, $4, $5, 'KES'), ($6, $2, 'house:clearing', $7, $5, 'KES')",
    [
      randomUUID(),
      entryId,
      `wallet:${input.walletId}`,
      input.walletDirection,
      input.amountMinor,
      randomUUID(),
      opposite,
    ]
  );
  return entryId;
}
