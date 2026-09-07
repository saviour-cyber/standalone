import "dotenv/config";
import express from "express";
import { createServer } from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { healthcheck } from "../db";
import { registerRealtime } from "../realtime";
import { validateEnvironment } from "./env";
import { processPaymentWebhook } from "../webhooks";
import { handleDarajaCallback } from "../services/daraja";

async function startServer() {
  validateEnvironment();
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.post(
    "/api/webhooks/payments",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const rawBody = Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : "";
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        const result = await processPaymentWebhook({
          signature: req.header("x-provider-signature") || undefined,
          rawBody,
          payload,
        });
        res.status(200).json(result);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid webhook",
        });
      }
    }
  );
  app.post(
    "/api/webhooks/daraja",
    express.json({ limit: "1mb" }),
    (req, res) => {
      try {
        const result = handleDarajaCallback(req.body);
        res.status(200).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.get("/health", async (_req, res) =>
    res.json({
      ok: true,
      service: "aviator-platform",
      database: await healthcheck(),
      realMoneyEnabled: process.env.REAL_MONEY_ENABLED === "true",
    })
  );
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  registerRealtime(server);
  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () =>
    console.log(`Aviator platform listening on port ${port}`)
  );
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
