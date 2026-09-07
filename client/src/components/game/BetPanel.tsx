import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Zap, Check } from "lucide-react";

interface BetPanelProps {
  id: string;
  title: string;
  roundStatus: string;
  currentMultiplier: number;
  activeBet?: {
    id: string;
    stakeMinor: number;
    status: string;
    payoutMinor?: number;
  } | null;
  onPlaceBet: (stakeMinor: number) => void;
  onCashOut: (betId: string, multiplier: number) => void;
  disabled?: boolean;
}

export function BetPanel({
  id,
  title,
  roundStatus,
  currentMultiplier,
  activeBet,
  onPlaceBet,
  onCashOut,
  disabled = false,
}: BetPanelProps) {
  const [stakeKes, setStakeKes] = useState("100");
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState(false);
  const [autoCashOutTarget, setAutoCashOutTarget] = useState("2.00");
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const hasAutoCashedOutRef = useRef(false);

  const isRunning = roundStatus === "MULTIPLIER_RUNNING";
  const isBettingOpen =
    roundStatus === "ROUND_CREATED" || roundStatus === "ROUND_STARTED";
  const isCrashed =
    roundStatus === "ROUND_CRASHED" ||
    roundStatus === "SETTLEMENT_PENDING" ||
    roundStatus === "SETTLED";
  const isBetPlaced = Boolean(activeBet && activeBet.status === "PLACED");
  const isCashedOut = Boolean(activeBet && activeBet.status === "CASHED_OUT");

  // Auto Cash Out Trigger
  useEffect(() => {
    if (!isBetPlaced || !autoCashOutEnabled) return;
    const target = parseFloat(autoCashOutTarget);
    if (isNaN(target) || target <= 1.0) return;

    if (activeBet && currentMultiplier >= target && !hasAutoCashedOutRef.current) {
      hasAutoCashedOutRef.current = true;
      onCashOut(activeBet.id, currentMultiplier);
    }
  }, [currentMultiplier, isBetPlaced, autoCashOutEnabled, autoCashOutTarget, activeBet, onCashOut]);

  // Reset auto cashout ref when new round begins
  useEffect(() => {
    if (roundStatus === "ROUND_CREATED" || roundStatus === "ROUND_STARTED") {
      hasAutoCashedOutRef.current = false;
      // Auto bet execution if enabled
      if (autoBetEnabled && !activeBet) {
        const amount = Math.round((parseFloat(stakeKes) || 100) * 100);
        onPlaceBet(amount);
      }
    }
  }, [roundStatus, autoBetEnabled]);

  const handleQuickStake = (delta: number) => {
    const curr = parseFloat(stakeKes) || 0;
    setStakeKes(Math.max(10, curr + delta).toFixed(0));
  };

  const handleMultiply = (mult: number) => {
    const curr = parseFloat(stakeKes) || 0;
    setStakeKes(Math.max(10, Math.round(curr * mult)).toFixed(0));
  };

  const stakeNumber = parseFloat(stakeKes) || 100;
  const stakeMinor = Math.round(stakeNumber * 100);
  const potentialPayout = (stakeNumber * currentMultiplier).toFixed(2);

  return (
    <div className="bg-[#121715] border border-[#27312d] rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-lg hover:border-zinc-700 transition-all">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoBetEnabled}
              onChange={(e) => setAutoBetEnabled(e.target.checked)}
              className="accent-[#c9f36b] rounded w-3.5 h-3.5 cursor-pointer"
            />
            Auto Bet
          </label>
        </div>
      </div>

      {/* Stake Input & Quick Multipliers */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2 focus-within:border-lime-400/70 transition-all">
          <span className="text-xs font-mono text-zinc-500 uppercase font-bold">Stake</span>
          <input
            type="number"
            value={stakeKes}
            onChange={(e) => setStakeKes(e.target.value)}
            disabled={isBetPlaced}
            className="w-full bg-transparent text-right font-mono font-bold text-white text-base focus:outline-none"
            placeholder="100"
            min="10"
          />
          <span className="text-xs font-mono font-semibold text-lime-400">KES</span>
        </div>

        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-5 gap-1 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => handleQuickStake(50)}
            disabled={isBetPlaced}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 py-1 rounded-md border border-zinc-800 transition"
          >
            +50
          </button>
          <button
            type="button"
            onClick={() => handleQuickStake(100)}
            disabled={isBetPlaced}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 py-1 rounded-md border border-zinc-800 transition"
          >
            +100
          </button>
          <button
            type="button"
            onClick={() => handleQuickStake(500)}
            disabled={isBetPlaced}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 py-1 rounded-md border border-zinc-800 transition"
          >
            +500
          </button>
          <button
            type="button"
            onClick={() => handleMultiply(0.5)}
            disabled={isBetPlaced}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 py-1 rounded-md border border-zinc-800 transition"
          >
            ½
          </button>
          <button
            type="button"
            onClick={() => handleMultiply(2)}
            disabled={isBetPlaced}
            className="bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 py-1 rounded-md border border-zinc-800 transition"
          >
            2X
          </button>
        </div>
      </div>

      {/* Auto Cash-Out Settings */}
      <div className="flex items-center justify-between bg-[#0b0e0d]/60 border border-zinc-800/80 rounded-xl px-3 py-1.5">
        <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoCashOutEnabled}
            onChange={(e) => setAutoCashOutEnabled(e.target.checked)}
            className="accent-[#c9f36b] rounded w-3.5 h-3.5 cursor-pointer"
          />
          Auto Cash Out
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            min="1.1"
            value={autoCashOutTarget}
            onChange={(e) => setAutoCashOutTarget(e.target.value)}
            disabled={!autoCashOutEnabled}
            className={`w-16 text-right font-mono text-xs px-2 py-0.5 rounded border ${
              autoCashOutEnabled
                ? "bg-zinc-900 border-zinc-700 text-lime-400 font-bold"
                : "bg-transparent border-transparent text-zinc-600"
            } focus:outline-none`}
          />
          <span className="text-xs font-mono text-zinc-500">x</span>
        </div>
      </div>

      {/* Primary Action Button */}
      {!isBetPlaced ? (
        <Button
          type="button"
          onClick={() => onPlaceBet(stakeMinor)}
          disabled={disabled || !isBettingOpen}
          className={`w-full h-12 font-mono font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${
            isBettingOpen
              ? "bg-gradient-to-r from-[#c9f36b] to-[#a3e635] hover:from-[#d4f685] hover:to-[#b4f044] text-[#0d140e] shadow-lime-950/40 cursor-pointer"
              : "bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-70"
          }`}
        >
          <Zap
            size={16}
            className={isBettingOpen ? "fill-current" : "text-zinc-600"}
          />
          {isBettingOpen
            ? `BET ${stakeKes} KES`
            : isRunning
            ? "IN FLIGHT (WAIT FOR NEXT ROUND)"
            : "WAITING FOR NEXT ROUND..."}
        </Button>
      ) : isCashedOut && activeBet ? (
        <div className="w-full h-12 bg-emerald-950/70 border border-emerald-700/60 text-emerald-400 font-mono font-bold text-sm rounded-xl flex items-center justify-center gap-2">
          <Check size={16} />
          Cashed Out! +{((activeBet.payoutMinor || 0) / 100).toFixed(2)} KES
        </div>
      ) : activeBet ? (
        <Button
          type="button"
          onClick={() => onCashOut(activeBet.id, currentMultiplier)}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-mono font-extrabold text-sm rounded-xl flex flex-col items-center justify-center shadow-lg shadow-orange-950/40 animate-pulse transition-all active:scale-[0.98]"
        >
          <span className="text-[11px] uppercase tracking-wider opacity-90">CASH OUT</span>
          <span className="text-base font-black leading-tight">
            {potentialPayout} KES ({currentMultiplier.toFixed(2)}x)
          </span>
        </Button>
      ) : null}
    </div>
  );
}
