import { describe, expect, it } from "vitest";
import { processPaymentWebhook } from "./webhooks";

describe("payment webhooks", () => {
  it("rejects unsigned callbacks", async () => {
    await expect(
      processPaymentWebhook({ rawBody: "{}", payload: { id: "evt-unsigned" } })
    ).rejects.toThrow("Invalid payment webhook signature");
  });
  it("accepts a signed sandbox callback once and marks repeats as duplicates", async () => {
    const input = {
      signature: "sandbox-signature",
      rawBody: JSON.stringify({ id: `evt-${Date.now()}` }),
      payload: { id: `evt-${Date.now()}`, eventType: "deposit.completed" },
    };
    input.rawBody = JSON.stringify(input.payload);
    const first = await processPaymentWebhook(input);
    const second = await processPaymentWebhook(input);
    expect(first.status).toBe("ACCEPTED");
    expect(second.status).toBe("DUPLICATE");
  });
});
