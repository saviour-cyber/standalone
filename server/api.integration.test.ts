import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { loginUser, registerUser, seedOperator } from "./auth";
import { allAudit } from "./services/platform";
import { gameState } from "./services/game";
import type { TrpcContext } from "./_core/context";

function context(
  role: "PLAYER" | "ADMIN",
  cookies: Record<string, string> = {}
): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: `api-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@example.test`,
      displayName: role,
      role,
      status: "ACTIVE",
      kycStatus: "VERIFIED",
      jurisdiction: "KE",
      dateOfBirth: new Date("1990-01-01"),
      riskStatus: "CLEAR",
      createdAt: now,
      updatedAt: now,
    },
    cookies,
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string) => {
        cookies[name] = value;
      },
      clearCookie: (name: string) => {
        delete cookies[name];
      },
    } as TrpcContext["res"],
  };
}

describe("typed API integration surface", () => {
  it("runs application-owned register, login, refresh, and logout procedures", async () => {
    const cookies: Record<string, string> = {};
    const caller = appRouter.createCaller(context("PLAYER", cookies));
    const email = `auth-api-${Date.now()}@example.test`;
    const registered = await caller.auth.register({
      email,
      password: "StrongPass123!",
      displayName: "API Player",
    });
    expect(registered.user.email).toBe(email);
    expect(cookies.aviator_access).toBeTruthy();
    expect(cookies.aviator_refresh).toBeTruthy();
    const refreshed = await caller.auth.refresh();
    expect(refreshed.accessToken).toBeTruthy();
    await caller.auth.logout();
    expect(cookies.aviator_refresh).toBeUndefined();
  });

  it("serves protected player dashboard data", async () => {
    const result = await appRouter
      .createCaller(context("PLAYER"))
      .player.dashboard();
    expect(result.user.role).toBe("PLAYER");
    expect(result.wallet.currency).toBe("KES");
  });

  it("allows operations roles to read overview and financial collections", async () => {
    const caller = appRouter.createCaller(context("ADMIN"));
    const result = await caller.operations.overview();
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("ledgerEntries");
    await expect(caller.operations.users()).resolves.toBeInstanceOf(Array);
    await expect(caller.operations.deposits()).resolves.toBeInstanceOf(Array);
    await expect(caller.operations.ledger()).resolves.toBeInstanceOf(Array);
    await expect(caller.operations.risk()).resolves.toBeInstanceOf(Array);
    await expect(caller.operations.audit()).resolves.toBeInstanceOf(Array);
    await expect(caller.operations.rounds()).resolves.toBeInstanceOf(Array);
  });

  it("rejects player access to operations data", async () => {
    await expect(
      appRouter.createCaller(context("PLAYER")).operations.overview()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("audits privileged withdrawal actions and rejects invalid credentials", async () => {
    const before = allAudit().length;
    const result = await appRouter
      .createCaller(context("ADMIN"))
      .operations.approveWithdrawal({
        withdrawalId: "sandbox-withdrawal",
        nextStatus: "APPROVED",
      });
    expect(result.success).toBe(true);
    expect(allAudit().length).toBeGreaterThan(before);
    const email = `abuse-${Date.now()}@example.test`;
    await registerUser({
      email,
      password: "StrongPass123!",
      displayName: "Abuse Test",
    });
    await expect(loginUser(email, "wrong-password")).rejects.toThrow(
      "Invalid email or password"
    );
  });

  it("enforces backend bet timeout rejecting stakes on expired or non-active rounds", async () => {
    const caller = appRouter.createCaller(context("PLAYER"));
    await expect(
      caller.player.bet({
        stakeMinor: 500,
        roundId: "expired-round-9999",
      })
    ).rejects.toThrow("Round has ended. Please wait for the next round.");
  });

  it("strictly prohibits bets when round ID is mismatched or flight is in progress", () => {
    expect(() => gameState.assertCanBet("invalid-round-id")).toThrow(
      "Round has ended. Please wait for the next round."
    );
  });

  it("authenticates administrative personnel through adminLogin and rejects non-admin accounts", async () => {
    await seedOperator();
    const caller = appRouter.createCaller(context("PLAYER"));
    // 1. Admin login with operator credentials succeeds
    const adminSession = await caller.auth.adminLogin({
      email: "operator@aviator.local",
      password: "ChangeMe123!",
    });
    expect(adminSession.user.role).toBe("ADMIN");

    // 2. Admin login with a regular player account fails
    const playerEmail = `regular-player-${Date.now()}@example.test`;
    await registerUser({
      email: playerEmail,
      password: "StrongPass123!",
      displayName: "Regular Player",
    });
    await expect(
      caller.auth.adminLogin({
        email: playerEmail,
        password: "StrongPass123!",
      })
    ).rejects.toThrow(
      "Access Denied: Account lacks administrative privileges."
    );
  });
});
