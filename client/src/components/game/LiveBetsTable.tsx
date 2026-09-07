import { useMemo } from "react";
import { Users, ArrowUpRight } from "lucide-react";

interface LiveBetsTableProps {
  currentMultiplier: number;
  roundStatus: string;
  userStakeMinor?: number;
  userCashedOut?: boolean;
}

// Simulated active players for social ambiance
const SIMULATED_PLAYERS = [
  { id: "p1", name: "Mwangi_K", stake: 500, target: 1.45 },
  { id: "p2", name: "Achieng99", stake: 1200, target: 2.1 },
  { id: "p3", name: "Kipchoge_Runner", stake: 250, target: 1.25 },
  { id: "p4", name: "Brian_N", stake: 2000, target: 3.4 },
  { id: "p5", name: "Wanjiku_Lucky", stake: 800, target: 1.85 },
  { id: "p6", name: "Otieno_Pilot", stake: 150, target: 1.15 },
  { id: "p7", name: "Zainab_M", stake: 3500, target: 5.0 },
];

export function LiveBetsTable({
  currentMultiplier,
  roundStatus,
  userStakeMinor,
  userCashedOut,
}: LiveBetsTableProps) {
  const isRunning = roundStatus === "MULTIPLIER_RUNNING";
  const isCrashed = roundStatus === "ROUND_CRASHED" || roundStatus === "SETTLEMENT_PENDING";

  const totalBets = SIMULATED_PLAYERS.length + (userStakeMinor ? 1 : 0);
  const totalStakeKes =
    SIMULATED_PLAYERS.reduce((acc, p) => acc + p.stake, 0) +
    (userStakeMinor ? userStakeMinor / 100 : 0);

  return (
    <div className="bg-[#121715] border border-[#27312d] rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-lime-400" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
            All Bets ({totalBets})
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-400">
          KES {totalStakeKes.toLocaleString()}
        </span>
      </div>

      <div className="overflow-y-auto max-h-[320px] flex flex-col gap-1.5 pr-1 text-xs font-mono">
        {/* Current User Row if bet placed */}
        {userStakeMinor && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-lime-950/40 border border-lime-500/40">
            <span className="font-bold text-lime-400">You</span>
            <span className="text-zinc-200 font-semibold">
              KES {(userStakeMinor / 100).toLocaleString()}
            </span>
            {userCashedOut ? (
              <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/60 flex items-center gap-1">
                <ArrowUpRight size={12} /> Cashed
              </span>
            ) : isCrashed ? (
              <span className="text-red-400 opacity-60">Crashed</span>
            ) : (
              <span className="text-amber-300 animate-pulse">In Flight</span>
            )}
          </div>
        )}

        {/* Simulated Community Players */}
        {SIMULATED_PLAYERS.map((player) => {
          const hasCashedOut = isRunning && currentMultiplier >= player.target;
          const payoutKes = (player.stake * player.target).toFixed(0);

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all ${
                hasCashedOut
                  ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                  : isCrashed
                  ? "bg-zinc-900/30 border-zinc-800/50 text-zinc-500"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
              }`}
            >
              <span className="truncate max-w-[90px] text-zinc-400">{player.name}</span>
              <span className="font-medium text-zinc-200">KES {player.stake}</span>
              {hasCashedOut ? (
                <div className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span>{player.target.toFixed(2)}x</span>
                  <span className="text-[10px] opacity-75">({payoutKes})</span>
                </div>
              ) : isCrashed ? (
                <span className="text-red-400 text-[10px]">Crashed</span>
              ) : (
                <span className="text-zinc-600 text-[11px]">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
