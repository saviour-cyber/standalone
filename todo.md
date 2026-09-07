# Project TODO

- [x] Complete the application source/config/dependency audit for platform-specific authentication, SDK, storage, API, environment, and runtime dependencies (generated management metadata is excluded from runtime)
- [x] Persist application-owned users and refresh sessions in PostgreSQL when configured, remove hardcoded fallback secrets and automatic seeded credentials, and enforce validated production configuration (development fallback is isolated and explicit)
- [x] Replace the scaffold database model with portable PostgreSQL-oriented domain models for users, sessions, wallets, ledger entries, payments, withdrawals, game rounds, bets, eligibility, limits, risk cases, and audit logs
- [x] Implement a true balanced double-entry ledger with opposing debit/credit legs, available/reserved balances, idempotent deposits, bet reservations, payouts, reversals, completed-withdrawal postings, and withdrawal state transitions (durable PostgreSQL path writes balanced ledger legs)
- [x] Implement verified payment webhook/callback endpoints, idempotent processing, reconciliation persistence, and sandbox/mock adapters with production activation disabled by default (development fallback remains isolated)
- [x] Implement eligibility and player-protection boundaries for age/KYC, approved geolocation decisions, explicit jurisdiction policy enforcement, wagering/deposit limits, cooling-off, self-exclusion, and risk-review states (policy provider is explicit and production fails closed without configuration)
- [x] Implement real bet placement, round-bound duplicate cash-out protection, and ledger-backed round settlement with concurrency-safe transactions alongside the authoritative lifecycle and realtime events (cash-out/settlement paths use row locks and round identity checks)
- [x] Complete functional bet placement, round history, and backend-wired player-protection controls in the elegant React player experience (development repository; durable production persistence remains separately gated)
- [x] Complete the operations dashboard sections for wallets/ledger, deposits, bets, rounds, risk/compliance queues, and working search/filtering (development repository; durable production persistence remains separately gated)
- [x] Enforce environment validation during startup and complete the portable typed API, health, Docker, Compose, PostgreSQL/Redis, and documentation contract
- [ ] Add integration tests for auth register/login/refresh/logout, player financial routes, operations routes, and the payment webhook callback path
- [ ] Add durable PostgreSQL-path tests for balanced ledger legs, completed-withdrawal postings, and cash-out/settlement transactions
- [ ] Add rate-limiting tests and broader RBAC/audit tests for privileged operations and authentication abuse cases
- [ ] Add portability tests for Docker/Compose startup and environment-validation failure cases, plus provider contracts
- [x] Add focused unit, provider, webhook, idempotency, protection, and concurrency tests for critical sandbox flows (17 tests pass)
- [x] Add and run linting, then complete the application source/config/dependency audit for accidental platform coupling (generated management metadata is excluded from runtime)
- [ ] Save a final checkpoint after all production gaps are resolved and the runnable project is verified
