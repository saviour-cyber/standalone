import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";

type LedgerClient = {
  query: <T = any>(
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
};

export async function postLedgerEntry(input: {
  walletId: string;
  type: string;
  amountMinor: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("Ledger amount must be a positive minor-unit integer");
  return withTransaction(async (client: LedgerClient) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM ledger_entries WHERE idempotency_key = $1 LIMIT 1",
      [input.idempotencyKey]
    );
    if (existing.rows[0]) return { duplicate: true, id: existing.rows[0].id };
    const wallet = await client.query<{
      id: string;
      available_minor: string;
      reserved_minor: string;
    }>(
      "SELECT id, available_minor, reserved_minor FROM wallets WHERE id = $1 FOR UPDATE",
      [input.walletId]
    );
    if (!wallet.rows[0]) throw new Error("Wallet not found");
    const id = randomUUID();
    await client.query(
      "INSERT INTO ledger_entries (id, wallet_id, type, amount_minor, currency, reference, idempotency_key, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        id,
        input.walletId,
        input.type,
        input.amountMinor,
        input.currency,
        input.reference,
        input.idempotencyKey,
        input.metadata || {},
      ]
    );
    return { duplicate: false, id };
  });
}

export async function reserveWallet(input: {
  walletId: string;
  amountMinor: number;
  reference: string;
  idempotencyKey: string;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    throw new Error("Reservation amount must be a positive minor-unit integer");
  return withTransaction(async (client: LedgerClient) => {
    const wallet = await client.query<{ available_minor: string }>(
      "SELECT available_minor FROM wallets WHERE id = $1 FOR UPDATE",
      [input.walletId]
    );
    const available = Number(wallet.rows[0]?.available_minor || 0);
    if (!wallet.rows[0] || available < input.amountMinor)
      throw new Error("Insufficient available balance");
    await client.query(
      "UPDATE wallets SET available_minor = available_minor - $1, reserved_minor = reserved_minor + $1, updated_at = NOW() WHERE id = $2",
      [input.amountMinor, input.walletId]
    );
    return postLedgerEntryOnClient(client, {
      walletId: input.walletId,
      type: "BET_RESERVATION",
      amountMinor: input.amountMinor,
      currency: "KES",
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
    });
  });
}

async function postLedgerEntryOnClient(
  client: LedgerClient,
  input: {
    walletId: string;
    type: string;
    amountMinor: number;
    currency: string;
    reference: string;
    idempotencyKey: string;
  }
) {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM ledger_entries WHERE idempotency_key = $1 LIMIT 1",
    [input.idempotencyKey]
  );
  if (existing.rows[0]) return { duplicate: true, id: existing.rows[0].id };
  const id = randomUUID();
  await client.query(
    "INSERT INTO ledger_entries (id, wallet_id, type, amount_minor, currency, reference, idempotency_key, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)",
    [
      id,
      input.walletId,
      input.type,
      input.amountMinor,
      input.currency,
      input.reference,
      input.idempotencyKey,
    ]
  );
  return { duplicate: false, id };
}
