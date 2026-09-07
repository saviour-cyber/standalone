# Aviator Standalone Platform

This repository contains a production-first, standalone crash-game platform foundation. The player interface and operations console are React applications served by a Node.js and TypeScript backend. The backend owns authentication, authorization, wallet state, sandbox payment flows, round authority, realtime events, and audit records.

## Development mode

The default runtime uses application-owned cookie sessions, an in-memory development repository when PostgreSQL is unavailable, a protected server-authoritative round loop, and mock or sandbox provider adapters. `REAL_MONEY_ENABLED` is false by default. The seeded operations account is `operator@aviator.local` with password `ChangeMe123!`; change or remove this development credential before any shared environment is used.

Run `pnpm install`, copy the variables in `docs/env.example` into a local environment, start PostgreSQL and Redis with `docker compose up -d postgres redis`, then run `pnpm dev`. The player surface is available at `/`; the operations surface is available at `/operations` after signing in with an operations role.

## Independent deployment

Build and run the project with `docker compose up --build`. The Compose file starts PostgreSQL, Redis, and the application. The generated SQL migration in `drizzle/0000_oval_sunfire.sql` is the portable PostgreSQL schema baseline. Apply it to the target PostgreSQL database using the organization’s migration procedure before enabling durable database-backed repositories.

## Security and production gates

The provider interfaces are intentionally designed so mock and sandbox implementations exercise the same contract as future approved production adapters. Live payment activation is disabled unless the production provider contract, webhook signature verification, reconciliation workflow, credentials, jurisdiction policy, compliance review, security review, responsible-gambling controls, and operational runbooks are approved.

The current UI is a verified platform foundation and sandbox workflow, not a claim that the service is licensed or ready to accept public wagers. For local operator access, set `DEV_SEED_OPERATOR=true` explicitly; it is disabled by default and ignored in production. Before production operation, replace the in-memory fallbacks with the transactional PostgreSQL repositories, implement the approved identity/geolocation/risk providers, complete fairness review and independent testing, add a production secrets manager, run penetration and load tests, and obtain all required legal and regulatory approvals.

## Verification

Run `pnpm run check` for TypeScript validation and `pnpm test` for the core application tests. Review `/health` for runtime health and provider-mode status. Run a source and dependency audit to confirm that the application path contains no platform-specific authentication, storage, APIs, or runtime assumptions.
