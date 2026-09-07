import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlightCanvas } from "@/components/game/FlightCanvas";
import { BetPanel } from "@/components/game/BetPanel";
import { LiveBetsTable } from "@/components/game/LiveBetsTable";
import { DepositModal } from "@/components/wallet/DepositModal";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { ResponsibleGamingModal } from "@/components/protection/ResponsibleGamingModal";
import { ProvablyFairModal } from "@/components/game/ProvablyFairModal";
import { useGameSocket, GameState } from "@/hooks/useGameSocket";
import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  LogOut,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
  Shield,
  HelpCircle,
} from "lucide-react";

const money = (minor = 0) =>
  `KES ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  // Queries
  const dashboard = trpc.player.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 2500,
  });
  const round = trpc.player.round.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 2000,
  });
  const bets = trpc.player.bets.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 1500,
  });
  const roundHistory = trpc.player.roundHistory.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  // Realtime Socket Sync with fallback to tRPC
  const { gameState } = useGameSocket(round.data as GameState | undefined);

  // Mutations
  const deposit = trpc.player.deposit.useMutation({
    onSuccess: () => dashboard.refetch(),
  });
  const mpesaDeposit = trpc.player.promptMpesaDeposit.useMutation({
    onSuccess: () => dashboard.refetch(),
  });
  const withdraw = trpc.player.withdraw.useMutation({
    onSuccess: () => dashboard.refetch(),
  });
  const controls = trpc.player.controls.useMutation({
    onSuccess: () => {
      setNotice("Player-protection control updated and enforced server-side.");
      dashboard.refetch();
    },
  });
  const bet = trpc.player.bet.useMutation({
    onSuccess: () => {
      bets.refetch();
      dashboard.refetch();
      setNotice("Bet accepted and reserved in the ledger.");
    },
    onError: (e) => setNotice(e.message || "Failed to place bet"),
  });
  const cashOut = trpc.player.cashOut.useMutation({
    onSuccess: (data) => {
      bets.refetch();
      dashboard.refetch();
      setNotice(`Cashed out successfully! +KES ${(data.payoutMinor / 100).toFixed(2)}`);
    },
    onError: (e) => setNotice(e.message || "Cash out failed"),
  });

  // Modal states
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  const [fairnessOpen, setFairnessOpen] = useState(false);
  const [selectedFairRound, setSelectedFairRound] = useState<any>(null);
  const [notice, setNotice] = useState("");

  const wallet = dashboard.data?.wallet;
  const activity = useMemo(
    () => dashboard.data?.ledger?.slice(0, 6) ?? [],
    [dashboard.data]
  );

  // Track active bets for current round
  const currentRoundId = gameState.id;
  const currentRoundBets = useMemo(
    () => (bets.data || []).filter((b: any) => b.roundId === currentRoundId),
    [bets.data, currentRoundId]
  );

  const activeBet1 = currentRoundBets[0] || null;
  const activeBet2 = currentRoundBets[1] || null;

  const handlePlaceBet = (stakeMinor: number) => {
    setNotice("");
    bet.mutate({
      stakeMinor,
      roundId: currentRoundId,
    });
  };

  const handleCashOut = (betId: string, mult: number) => {
    setNotice("");
    cashOut.mutate({
      betId,
      multiplier: mult,
    });
  };

  if (!isAuthenticated) return <Landing />;

  return (
    <main className="player-shell min-h-screen bg-[#0b0e0d] text-zinc-100 flex flex-col">
      {/* Navigation Header */}
      <header className="player-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark small">A</span>
          <span>
            Aviator <em>platform</em>
          </span>
        </Link>
        <nav>
          <a href="#play">Play</a>
          <a href="#wallet">Wallet</a>
          <a href="#safety">Protection</a>
          <button
            type="button"
            onClick={() => {
              setSelectedFairRound(gameState);
              setFairnessOpen(true);
            }}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition bg-transparent border-0 p-0 text-xs font-mono cursor-pointer"
          >
            <Shield size={14} className="text-lime-400" /> Provably Fair
          </button>
          {[
            "ADMIN",
            "SUPER_ADMIN",
            "COMPLIANCE_OFFICER",
            "RISK_ANALYST",
            "PAYMENTS_OPERATOR",
            "SUPPORT",
          ].includes(user?.role || "") && (
            <Link href="/operations">
              Operations <ArrowUpRight size={14} />
            </Link>
          )}
        </nav>
        <div className="nav-actions">
          <div className="hidden sm:flex flex-col items-end text-xs font-mono mr-2">
            <span className="text-zinc-400 font-semibold">{user?.displayName}</span>
            <span className="text-lime-400 font-bold">{money(wallet?.availableMinor)}</span>
          </div>
          <button className="icon-button" onClick={logout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Sandbox Alert Banner */}
      <div className="status-banner">
        <ShieldCheck size={15} />
        <span>Sandbox provider mode</span>
        <strong>Production payment activation is disabled by default.</strong>
        <ChevronRight size={15} />
      </div>

      <div className="px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6 py-6" id="play">
        {/* Notice alert */}
        {notice && (
          <div className="p-3 bg-zinc-900/90 border border-lime-500/50 rounded-xl text-xs font-mono text-lime-300 flex items-center justify-between animate-in fade-in">
            <span>{notice}</span>
            <button
              onClick={() => setNotice("")}
              className="text-zinc-500 hover:text-white ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Game Stage Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Flight & Dual Betting (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* 2D Canvas Arena */}
            <FlightCanvas
              status={gameState.status}
              multiplier={gameState.multiplier}
              crashMultiplier={gameState.crashMultiplier}
              roundNumber={gameState.roundNumber}
            />

            {/* Dual Betting Strips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BetPanel
                id="panel-1"
                title="Bet 1"
                roundStatus={gameState.status}
                currentMultiplier={gameState.multiplier}
                activeBet={activeBet1}
                onPlaceBet={handlePlaceBet}
                onCashOut={handleCashOut}
                disabled={bet.isPending}
              />
              <BetPanel
                id="panel-2"
                title="Bet 2"
                roundStatus={gameState.status}
                currentMultiplier={gameState.multiplier}
                activeBet={activeBet2}
                onPlaceBet={handlePlaceBet}
                onCashOut={handleCashOut}
                disabled={bet.isPending}
              />
            </div>
          </div>

          {/* Social Multiplayer Live Bets (1 col) */}
          <div className="flex flex-col gap-4">
            <LiveBetsTable
              currentMultiplier={gameState.multiplier}
              roundStatus={gameState.status}
              userStakeMinor={activeBet1?.stakeMinor || activeBet2?.stakeMinor}
              userCashedOut={Boolean(
                activeBet1?.status === "CASHED_OUT" || activeBet2?.status === "CASHED_OUT"
              )}
            />

            {/* Quick Wallet Card */}
            <Card className="wallet-card border-[#27312d] bg-[#121715]" id="wallet">
              <CardHeader className="pb-3">
                <div className="card-kicker text-zinc-400 flex items-center gap-1.5 text-xs font-mono">
                  <WalletCards size={15} className="text-lime-400" />
                  Available Balance
                </div>
                <CardTitle className="text-2xl font-mono font-bold text-white">
                  {money(wallet?.availableMinor)}
                </CardTitle>
                <p className="text-xs font-mono text-zinc-500">
                  {money(wallet?.reservedMinor)} in reserved bets
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setDepositOpen(true)}
                    className="bg-lime-400 hover:bg-lime-300 text-black font-mono font-bold text-xs h-10 rounded-xl"
                  >
                    + Deposit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setWithdrawOpen(true)}
                    className="border-zinc-800 hover:bg-zinc-800 text-zinc-200 font-mono text-xs h-10 rounded-xl"
                  >
                    Withdraw
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History & Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Round History (2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-3" id="history">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-lime-400 font-bold">
                  Verified Round History
                </span>
                <h2 className="text-lg font-bold text-white">Previous Multiplier Outcomes</h2>
              </div>
              <span className="text-xs font-mono text-zinc-500">Click to verify seed</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {(roundHistory.data || []).slice(0, 16).map((item: any) => {
                const mult = parseFloat(item.crashMultiplier) || 1.0;
                const isHigh = mult >= 2.0;
                const isVeryHigh = mult >= 10.0;
                return (
                  <button
                    key={String(item.id)}
                    type="button"
                    onClick={() => {
                      setSelectedFairRound(item);
                      setFairnessOpen(true);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center font-mono transition-all hover:scale-105 cursor-pointer ${
                      isVeryHigh
                        ? "bg-purple-950/40 border-purple-600/60 text-purple-300"
                        : isHigh
                        ? "bg-emerald-950/40 border-emerald-600/60 text-emerald-300"
                        : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <span className="text-sm font-extrabold">{mult.toFixed(2)}x</span>
                    <span className="text-[10px] opacity-70">#{item.roundNumber}</span>
                  </button>
                );
              })}
              {!(roundHistory.data || []).length && (
                <div className="col-span-full text-center py-6 text-xs font-mono text-zinc-500">
                  Waiting for first settled round...
                </div>
              )}
            </div>
          </div>

          {/* Recent Ledger Activity (1 col) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-lime-400 font-bold">
                  Audit Stream
                </span>
                <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
              </div>
            </div>

            <div className="bg-[#121715] border border-[#27312d] rounded-2xl p-4 flex flex-col gap-2">
              {activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/60"
                >
                  <div className="flex items-center gap-2">
                    <CircleDollarSign
                      size={14}
                      className={entry.amountMinor > 0 ? "text-emerald-400" : "text-zinc-500"}
                    />
                    <div>
                      <div className="font-semibold text-zinc-200">
                        {entry.type.replaceAll("_", " ")}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-bold ${
                      entry.amountMinor > 0 ? "text-emerald-400" : "text-zinc-400"
                    }`}
                  >
                    {entry.amountMinor > 0 ? "+" : ""}
                    {money(entry.amountMinor)}
                  </span>
                </div>
              ))}
              {!activity.length && (
                <p className="text-xs font-mono text-zinc-500 text-center py-4">
                  No transactions yet. Make a sandbox deposit to begin.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Responsible Gaming & Protection Banner */}
        <div className="bg-gradient-to-r from-zinc-900 to-[#121715] border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mt-4" id="safety">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center shrink-0">
              <ShieldCheck size={24} className="text-lime-400" />
            </div>
            <div>
              <h3 className="text-base font-bold font-mono text-white">
                Player Safety & Gaming Protection
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Set personalized daily deposit limits, wager limits, or schedule a cooling-off break anytime.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setProtectionOpen(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold px-5 h-10 rounded-xl border border-zinc-700 shrink-0"
          >
            Manage Protection Controls
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="player-footer mt-auto py-6 border-t border-zinc-800/80 px-6 text-center text-xs font-mono text-zinc-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full">
        <span>© 2026 Aviator Platform · Provably Fair Autorun Engine</span>
        <span>Sandbox Environment · No Real-Money Financial Activation</span>
      </footer>

      {/* Modals */}
      <DepositModal
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onDeposit={async (amountMinor, idempotencyKey) => {
          return deposit.mutateAsync({ amountMinor, idempotencyKey });
        }}
        onDepositMpesa={async (amountKes, phone) => {
          return mpesaDeposit.mutateAsync({ amountKes, phoneNumber: phone });
        }}
        isLoading={deposit.isPending || mpesaDeposit.isPending}
      />

      <WithdrawModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        availableMinor={wallet?.availableMinor || 0}
        onWithdraw={async (amountMinor) => {
          return withdraw.mutateAsync({ amountMinor });
        }}
        isLoading={withdraw.isPending}
      />

      <ResponsibleGamingModal
        open={protectionOpen}
        onOpenChange={setProtectionOpen}
        onSaveControls={async (input) => {
          return controls.mutateAsync(input);
        }}
        isLoading={controls.isPending}
      />

      <ProvablyFairModal
        open={fairnessOpen}
        onOpenChange={setFairnessOpen}
        round={selectedFairRound}
      />
    </main>
  );
}

function Landing() {
  return (
    <main className="landing-shell min-h-screen flex flex-col justify-between">
      <header className="player-nav">
        <div className="brand-lockup">
          <span className="brand-mark small">A</span>
          <span>
            Aviator <em>platform</em>
          </span>
        </div>
        <Link href="/login" className="primary-link font-mono text-xs">
          Sign in <ArrowUpRight size={15} />
        </Link>
      </header>
      <section className="landing-hero max-w-5xl mx-auto w-full px-6 py-16 flex flex-col md:flex-row items-center justify-between gap-12">
        <div>
          <p className="eyebrow text-lime-400 font-mono text-xs uppercase tracking-widest font-bold mb-2">
            A production-first crash game
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Simple to see.
            <br />
            <span className="text-lime-400">Hard to misread.</span>
          </h1>
          <p className="hero-sub text-zinc-400 text-sm sm:text-base mt-4 max-w-lg leading-relaxed">
            A clear, controlled player experience with server-authoritative
            rounds, auditable double-entry ledger balance movements, and visible player protection controls.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link href="/login" className="primary-link large font-mono text-sm bg-lime-400 hover:bg-lime-300 text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2">
              Enter the Platform <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="landing-panel bg-[#121715] border border-zinc-800 p-8 rounded-3xl max-w-sm shadow-2xl flex flex-col gap-4">
          <Sparkles size={24} className="text-lime-400" />
          <strong className="text-lg font-mono text-white">Authority you can inspect</strong>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            Every round has a cryptographically protected SHA-256 commitment. Every balance movement is posted to a balanced double-entry ledger. Every sensitive action is audited.
          </p>
        </div>
      </section>
      <footer className="py-6 border-t border-zinc-800 text-center text-xs font-mono text-zinc-500">
        © 2026 Aviator Platform · Real-time Crash Game Environment
      </footer>
    </main>
  );
}
