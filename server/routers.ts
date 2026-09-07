import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  operationsProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  loginUser,
  refreshAccessToken,
  registerUser,
  revokeRefreshToken,
} from "./auth";
import { gameState } from "./services/game";
import {
  durableCashOut,
  durableDeposit,
  durablePlaceBet,
  durableTransitionWithdrawal,
  durableWithdrawal,
} from "./services/durablePlatform";
import {
  getDarajaConfig,
  updateDarajaConfig,
  promptUserStkPush,
  listDarajaPrompts,
} from "./services/daraja";
import { getEligibilityProvider, getRiskProvider } from "./services/providers";
import {
  allAudit,
  allBets,
  allLedgerEntries,
  allPayments,
  allWallets,
  allWithdrawals,
  auditLog,
  demoDeposit,
  listBets,
  overview,
  placeBet,
  requestWithdrawal,
  riskQueue,
  setControls,
  userSummary,
  walletFor,
  cashOutBet,
} from "./services/platform";

const authResult = (
  ctx: { res: any },
  tokens: { accessToken: string; refreshToken: string }
) => {
  ctx.res.cookie("aviator_access", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
  ctx.res.cookie("aviator_refresh", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/api",
  });
  return tokens;
};

async function requireProductionEligibility(userId: string) {
  if (process.env.REAL_MONEY_ENABLED !== "true") return;
  const eligibility = getEligibilityProvider();
  const identity = await eligibility.verifyIdentity(userId);
  const location = await eligibility.verifyLocation(userId);
  const risk = await getRiskProvider().score(userId, { action: "financial" });
  if (
    identity.status !== "VERIFIED" ||
    !location.allowed ||
    risk.status !== "CLEAR"
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Player eligibility checks did not pass",
    });
}

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({
      ok: true,
      mode:
        process.env.REAL_MONEY_ENABLED === "true"
          ? "production-provider-disabled-by-default"
          : "sandbox",
    })),
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          displayName: z.string().min(2).max(120),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await registerUser(input);
        const result = authResult(
          ctx,
          await (await import("./auth")).loginUser(input.email, input.password)
        );
        auditLog(user.id, "AUTH_REGISTER", "USER", user.id);
        return result;
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await loginUser(input.email, input.password);
          auditLog(result.user.id, "AUTH_LOGIN", "USER", result.user.id);
          return authResult(ctx, result);
        } catch (error) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              error instanceof Error ? error.message : "Unable to sign in",
          });
        }
      }),
    adminLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await loginUser(input.email, input.password);
          const allowedOperationsRoles = [
            "ADMIN",
            "SUPER_ADMIN",
            "COMPLIANCE_OFFICER",
            "RISK_ANALYST",
            "PAYMENTS_OPERATOR",
            "SUPPORT",
          ];
          if (!allowedOperationsRoles.includes(result.user.role)) {
            throw new Error(
              "Access Denied: Account lacks administrative privileges."
            );
          }
          auditLog(result.user.id, "AUTH_ADMIN_LOGIN", "USER", result.user.id);
          return authResult(ctx, result);
        } catch (error) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              error instanceof Error
                ? error.message
                : "Unable to sign in as administrator",
          });
        }
      }),
    refresh: publicProcedure.mutation(async ({ ctx }) => {
      const token = ctx.cookies.aviator_refresh;
      if (!token)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Refresh session required",
        });
      return authResult(ctx, await refreshAccessToken(token));
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeRefreshToken(ctx.cookies.aviator_refresh);
      ctx.res.clearCookie("aviator_access");
      ctx.res.clearCookie("aviator_refresh", { path: "/api" });
      return { success: true };
    }),
  }),
  player: router({
    dashboard: protectedProcedure.query(({ ctx }) => userSummary(ctx.user)),
    deposit: protectedProcedure
      .input(
        z.object({
          amountMinor: z.number().int().positive(),
          idempotencyKey: z.string().min(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireProductionEligibility(ctx.user.id);
        const result =
          process.env.REAL_MONEY_ENABLED === "true"
            ? await durableDeposit({
                userId: ctx.user.id,
                amountMinor: input.amountMinor,
                idempotencyKey: `${ctx.user.id}:${input.idempotencyKey}`,
              })
            : demoDeposit(
                ctx.user.id,
                input.amountMinor,
                `${ctx.user.id}:${input.idempotencyKey}`
              );
        auditLog(ctx.user.id, "SANDBOX_DEPOSIT", "WALLET", ctx.user.id, {
          amountMinor: input.amountMinor,
        });
        return result;
      }),
    promptMpesaDeposit: protectedProcedure
      .input(
        z.object({
          phoneNumber: z.string(),
          amountKes: z.number().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireProductionEligibility(ctx.user.id);
        const res = await promptUserStkPush({
          phoneNumber: input.phoneNumber,
          amountKes: input.amountKes,
          accountReference: "AviatorKES",
          userId: ctx.user.id,
        });
        return res;
      }),
    withdraw: protectedProcedure
      .input(z.object({ amountMinor: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireProductionEligibility(ctx.user.id);
        const result =
          process.env.REAL_MONEY_ENABLED === "true"
            ? await durableWithdrawal({
                userId: ctx.user.id,
                amountMinor: input.amountMinor,
              })
            : requestWithdrawal(ctx.user.id, input.amountMinor);
        auditLog(ctx.user.id, "WITHDRAWAL_REQUESTED", "WITHDRAWAL", result.id, {
          amountMinor: input.amountMinor,
        });
        return result;
      }),
    controls: protectedProcedure
      .input(
        z.object({
          depositLimitMinor: z.number().int().positive().nullable().optional(),
          wagerLimitMinor: z.number().int().positive().nullable().optional(),
          coolingOffUntil: z.string().nullable().optional(),
          selfExcludedUntil: z.string().nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const result = setControls(ctx.user.id, input);
        auditLog(ctx.user.id, "PLAYER_CONTROLS_UPDATED", "USER", ctx.user.id);
        return result;
      }),
    round: protectedProcedure.query(() => gameState.snapshot()),
    roundHistory: protectedProcedure.query(() => gameState.historySnapshot()),
    bets: protectedProcedure.query(({ ctx }) => listBets(ctx.user.id)),
    bet: protectedProcedure
      .input(
        z.object({
          stakeMinor: z.number().int().positive(),
          roundId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          await requireProductionEligibility(ctx.user.id);
          gameState.assertCanBet(input.roundId);
          const result =
            process.env.REAL_MONEY_ENABLED === "true"
              ? await durablePlaceBet({
                  userId: ctx.user.id,
                  roundId: input.roundId,
                  stakeMinor: input.stakeMinor,
                  idempotencyKey: `${ctx.user.id}:${input.roundId}:${input.stakeMinor}`,
                })
              : placeBet(ctx.user.id, input.roundId, input.stakeMinor);
          auditLog(ctx.user.id, "BET_PLACED", "BET", result.id, {
            stakeMinor: input.stakeMinor,
          });
          return result;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Bet rejected",
          });
        }
      }),
    cashOut: protectedProcedure
      .input(z.object({ betId: z.string(), multiplier: z.number().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await requireProductionEligibility(ctx.user.id);
          const gameResult = gameState.cashOut(input.multiplier);
          const result =
            process.env.REAL_MONEY_ENABLED === "true"
              ? await durableCashOut({
                  userId: ctx.user.id,
                  betId: input.betId,
                  roundId: gameResult.roundId,
                  multiplier: gameResult.multiplier,
                })
              : cashOutBet(
                  ctx.user.id,
                  input.betId,
                  gameResult.roundId,
                  gameResult.multiplier
                );
          auditLog(ctx.user.id, "CASH_OUT_REQUESTED", "BET", input.betId, {
            multiplier: result.payoutMinor,
          });
          return result;
        } catch (error) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              error instanceof Error ? error.message : "Cash-out rejected",
          });
        }
      }),
  }),
  operations: router({
    overview: operationsProcedure.query(() => overview()),
    users: operationsProcedure.query(() =>
      import("./auth").then(({ listUsers }) => listUsers())
    ),
    user: operationsProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => {
        const user = import("./auth").then(({ getUserById }) =>
          getUserById(input.userId)
        );
        return user;
      }),
    withdrawals: operationsProcedure.query(() => allWithdrawals()),
    wallets: operationsProcedure.query(() => allWallets()),
    deposits: operationsProcedure.query(() => allPayments()),
    ledger: operationsProcedure.query(() => allLedgerEntries()),
    bets: operationsProcedure.query(() => allBets()),
    risk: operationsProcedure.query(() => riskQueue()),
    audit: operationsProcedure.query(() => allAudit()),
    rounds: operationsProcedure.query(() => [
      gameState.snapshot(),
      ...gameState.historySnapshot(),
    ]),
    approveWithdrawal: adminProcedure
      .input(
        z.object({
          withdrawalId: z.string(),
          nextStatus: z
            .enum([
              "APPROVED",
              "PROCESSING",
              "COMPLETED",
              "FAILED",
              "REJECTED",
              "REVERSED",
            ])
            .default("APPROVED"),
          reason: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result =
          process.env.REAL_MONEY_ENABLED === "true"
            ? await durableTransitionWithdrawal({
                withdrawalId: input.withdrawalId,
                nextStatus: input.nextStatus,
                reason: input.reason,
              })
            : { id: input.withdrawalId, status: input.nextStatus };
        auditLog(
          ctx.user.id,
          "WITHDRAWAL_STATE_TRANSITION",
          "WITHDRAWAL",
          input.withdrawalId,
          { nextStatus: input.nextStatus, reason: input.reason }
        );
        return { success: true, ...result };
      }),
    darajaConfig: operationsProcedure.query(() => getDarajaConfig(true)),
    updateDarajaConfig: adminProcedure
      .input(
        z.object({
          enabled: z.boolean().optional(),
          environment: z.enum(["sandbox", "production"]).optional(),
          consumerKey: z.string().optional(),
          consumerSecret: z.string().optional(),
          passkey: z.string().optional(),
          shortcode: z.string().optional(),
          callbackUrl: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const updated = updateDarajaConfig(input);
        auditLog(ctx.user.id, "DARAJA_CONFIG_UPDATED", "SYSTEM", "daraja", {
          environment: updated.environment,
          enabled: updated.enabled,
          shortcode: updated.shortcode,
        });
        return updated;
      }),
    testDarajaPrompt: operationsProcedure
      .input(
        z.object({
          phoneNumber: z.string(),
          amountKes: z.number().positive(),
          accountReference: z.string().optional(),
          userId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const res = await promptUserStkPush({
          phoneNumber: input.phoneNumber,
          amountKes: input.amountKes,
          accountReference: input.accountReference || "AviatorAdmin",
          userId: input.userId || ctx.user.id,
        });
        return res;
      }),
    darajaPrompts: operationsProcedure.query(() => listDarajaPrompts()),
  }),
});

export type AppRouter = typeof appRouter;
