import { createHash, randomBytes, randomUUID } from "node:crypto";

type RoundStatus =
  | "ROUND_CREATED"
  | "ROUND_STARTED"
  | "MULTIPLIER_RUNNING"
  | "ROUND_CRASHED"
  | "SETTLEMENT_PENDING"
  | "SETTLED";
type GameEvent = { type: string; payload: Record<string, unknown> };

class CrashGame {
  private listeners = new Set<(event: GameEvent) => void>();
  private round = this.createRound();
  private history: Array<Record<string, unknown>> = [];
  private startedAt = Date.now();
  private flightStartedAt = 0;
  private crashedAt = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.startLoop();
  }

  private createRound() {
    const seed = randomBytes(32).toString("hex");
    const crash =
      1.05 +
      (parseInt(
        createHash("sha256").update(seed).digest("hex").slice(0, 8),
        16
      ) %
        900) /
        100;
    return {
      id: randomUUID(),
      status: "ROUND_CREATED" as RoundStatus,
      commitment: createHash("sha256").update(seed).digest("hex"),
      crashMultiplier: Number(crash.toFixed(2)),
      seed,
      multiplier: 1,
      roundNumber: Math.floor(Date.now() / 1000),
    };
  }

  private startLoop() {
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
  }

  private tick() {
    const elapsed = Date.now() - this.startedAt;
    // 5-second betting window
    if (this.round.status === "ROUND_CREATED" && elapsed >= 5000) {
      this.transition("ROUND_STARTED");
    }
    // 800ms takeoff ignition
    if (this.round.status === "ROUND_STARTED" && elapsed >= 5800) {
      this.flightStartedAt = Date.now();
      this.transition("MULTIPLIER_RUNNING");
    }
    if (this.round.status === "MULTIPLIER_RUNNING") {
      const flightElapsed = Date.now() - (this.flightStartedAt || this.startedAt + 5800);
      this.round.multiplier = Number(
        (1 + Math.max(0, flightElapsed) / 4500).toFixed(2)
      );
      if (this.round.multiplier >= this.round.crashMultiplier) {
        this.crashedAt = Date.now();
        this.transition("ROUND_CRASHED");
      } else {
        this.emit("MULTIPLIER_UPDATE", {
          roundId: this.round.id,
          multiplier: this.round.multiplier,
        });
      }
    }
    if (this.round.status === "ROUND_CRASHED") {
      this.transition("SETTLEMENT_PENDING");
    }
    if (
      this.round.status === "SETTLEMENT_PENDING" &&
      Date.now() - (this.crashedAt || this.startedAt) >= 3500
    ) {
      this.transition("SETTLED");
      this.history.unshift(this.snapshot());
      this.history = this.history.slice(0, 20);
      this.round = this.createRound();
      this.startedAt = Date.now();
      this.flightStartedAt = 0;
      this.crashedAt = 0;
    }
  }

  private transition(status: RoundStatus) {
    this.round.status = status;
    this.emit(status, {
      roundId: this.round.id,
      multiplier: this.round.multiplier,
      commitment:
        status === "ROUND_CREATED" ? this.round.commitment : undefined,
    });
  }

  private emit(type: string, payload: Record<string, unknown>) {
    this.listeners.forEach(listener => listener({ type, payload }));
  }

  onEvent(listener: (event: GameEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot() {
    const elapsed = Date.now() - this.startedAt;
    const isBettingOpen =
      this.round.status === "ROUND_CREATED" ||
      this.round.status === "ROUND_STARTED";
    const bettingTimeoutRemainingMs = isBettingOpen
      ? Math.max(0, 5000 - elapsed)
      : 0;

    return {
      id: this.round.id,
      roundNumber: this.round.roundNumber,
      status: this.round.status,
      multiplier: this.round.multiplier,
      crashMultiplier:
        this.round.status === "ROUND_CRASHED" ||
        this.round.status === "SETTLEMENT_PENDING" ||
        this.round.status === "SETTLED"
          ? this.round.crashMultiplier
          : null,
      commitment: this.round.commitment,
      bettingOpen: isBettingOpen,
      bettingTimeoutRemainingMs,
    };
  }

  assertCanBet(roundId: string) {
    const current = this.snapshot();
    if (current.id !== roundId) {
      throw new Error("Round has ended. Please wait for the next round.");
    }
    const BETTING_OPEN_STATUSES: RoundStatus[] = [
      "ROUND_CREATED",
      "ROUND_STARTED",
    ];
    if (!BETTING_OPEN_STATUSES.includes(current.status as RoundStatus)) {
      throw new Error("Betting is closed — the round is already in flight.");
    }
  }

  cashOut(multiplier: number) {
    const current = this.snapshot();
    if (
      current.status !== "MULTIPLIER_RUNNING" ||
      multiplier > current.multiplier
    )
      throw new Error("Cash-out is no longer valid");
    return {
      roundId: current.id,
      multiplier: current.multiplier,
      settled: true,
    };
  }

  historySnapshot() {
    return this.history;
  }
}

export const gameState = new CrashGame();
