import { randomUUID } from "node:crypto";
import { getPaymentProvider } from "./services/providers";
import { query } from "./db";

export type ReconciliationRecord = {
  id: string;
  provider: string;
  providerReference: string;
  eventType: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE";
  receivedAt: string;
  payload: Record<string, unknown>;
};
const records = new Map<string, ReconciliationRecord>();

export async function processPaymentWebhook(input: {
  signature?: string;
  rawBody: string;
  payload: Record<string, unknown>;
}) {
  const provider = getPaymentProvider();
  if (!provider.verifyWebhook(input.signature, input.rawBody))
    throw new Error("Invalid payment webhook signature");
  const providerReference = String(
    input.payload.providerReference || input.payload.id || ""
  );
  if (!providerReference)
    throw new Error("Payment webhook reference is required");
  const existing = records.get(providerReference);
  if (existing) return { ...existing, status: "DUPLICATE" as const };
  const record: ReconciliationRecord = {
    id: randomUUID(),
    provider: provider.name,
    providerReference,
    eventType: String(input.payload.eventType || "payment.updated"),
    status: "ACCEPTED",
    receivedAt: new Date().toISOString(),
    payload: input.payload,
  };
  records.set(providerReference, record);
  if (process.env.DATABASE_URL) {
    try {
      await query(
        "INSERT INTO payments (id, user_id, provider, provider_reference, direction, amount_minor, currency, status, raw_event) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (provider_reference) DO NOTHING",
        [
          record.id,
          String(
            input.payload.userId || "00000000-0000-0000-0000-000000000000"
          ),
          record.provider,
          providerReference,
          String(input.payload.direction || "DEPOSIT"),
          Number(input.payload.amountMinor || 0),
          String(input.payload.currency || "KES"),
          String(input.payload.status || "COMPLETED"),
          input.payload,
        ]
      );
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
    }
  }
  return record;
}

export function reconciliationRecords() {
  return Array.from(records.values());
}
