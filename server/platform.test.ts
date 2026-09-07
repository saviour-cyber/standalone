import { describe, expect, it } from "vitest";
import { loginUser, registerUser } from "./auth";
import {
  allPayments,
  cashOutBet,
  demoDeposit,
  placeBet,
  requestWithdrawal,
  setControls,
  walletFor,
} from "./services/platform";

describe("standalone platform core", () => {
  it("registers and authenticates an application-owned user", async () => {
    const email = `player-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Test Player",
    });
    const session = await loginUser(email, "StrongPass123!");
    expect(session.user.id).toBe(user.id);
    expect(session.accessToken).toBeTypeOf("string");
    expect(session.refreshToken).toBeTypeOf("string");
  });

  it("does not duplicate a deposit callback with the same idempotency key", async () => {
    const email = `deposit-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Deposit Player",
    });
    const first = demoDeposit(user.id, 2500, `${user.id}:callback-1`);
    const second = demoDeposit(user.id, 2500, `${user.id}:callback-1`);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(walletFor(user.id).availableMinor).toBe(2500);
  });

  it("records sandbox deposits for operations reconciliation", async () => {
    const email = `deposit-ops-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Deposit Ops",
    });
    demoDeposit(user.id, 4200, `${user.id}:ops-payment`);
    expect(
      allPayments().some(
        payment =>
          payment.userId === user.id &&
          payment.amountMinor === 4200 &&
          payment.status === "COMPLETED"
      )
    ).toBe(true);
  });

  it("rejects cash-out when the round does not match the placed bet", async () => {
    const email = `round-bound-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Round Bound",
    });
    demoDeposit(user.id, 5000, `${user.id}:round-bound-deposit`);
    const bet = placeBet(user.id, "round-a", 1000);
    expect(() => cashOutBet(user.id, bet.id, "round-b", 1.2)).toThrow(
      "Bet is no longer eligible for cash-out"
    );
  });

  it("allows only one cash-out settlement for duplicate requests", async () => {
    const email = `cashout-race-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Cashout Race",
    });
    demoDeposit(user.id, 5000, `${user.id}:cashout-race-deposit`);
    const bet = placeBet(user.id, "round-race", 1000);
    const results = await Promise.allSettled([
      Promise.resolve().then(() =>
        cashOutBet(user.id, bet.id, "round-race", 1.25)
      ),
      Promise.resolve().then(() =>
        cashOutBet(user.id, bet.id, "round-race", 1.25)
      ),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(
      1
    );
  });

  it("enforces cooling-off before accepting a bet", async () => {
    const email = `controls-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Controls Player",
    });
    demoDeposit(user.id, 5000, `${user.id}:callback-controls`);
    setControls(user.id, {
      coolingOffUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(() => placeBet(user.id, "round-controls", 100)).toThrow(
      "Cooling-off period is active"
    );
  });

  it("reserves funds before a withdrawal enters review", async () => {
    const email = `withdraw-${Date.now()}@example.test`;
    const user = await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Withdrawal Player",
    });
    demoDeposit(user.id, 5000, `${user.id}:callback-2`);
    const withdrawal = requestWithdrawal(user.id, 1200);
    expect(withdrawal.status).toBe("ELIGIBILITY_REVIEW");
    expect(walletFor(user.id)).toMatchObject({
      availableMinor: 3800,
      reservedMinor: 1200,
    });
  });
});
