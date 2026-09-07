import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldAlert, Clock, Sliders, CheckCircle, AlertTriangle } from "lucide-react";

interface ResponsibleGamingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveControls: (input: {
    depositLimitMinor?: number | null;
    wagerLimitMinor?: number | null;
    coolingOffUntil?: string | null;
    selfExcludedUntil?: string | null;
  }) => Promise<any>;
  isLoading?: boolean;
}

export function ResponsibleGamingModal({
  open,
  onOpenChange,
  onSaveControls,
  isLoading,
}: ResponsibleGamingModalProps) {
  const [tab, setTab] = useState<"limits" | "timeout" | "exclude">("limits");
  const [depositLimitKes, setDepositLimitKes] = useState("");
  const [wagerLimitKes, setWagerLimitKes] = useState("");
  const [feedback, setFeedback] = useState("");

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSaveControls({
        depositLimitMinor: depositLimitKes ? Math.round(parseFloat(depositLimitKes) * 100) : null,
        wagerLimitMinor: wagerLimitKes ? Math.round(parseFloat(wagerLimitKes) * 100) : null,
      });
      setFeedback("Financial limits successfully updated and enforced.");
      setTimeout(() => {
        setFeedback("");
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      setFeedback(err.message || "Failed to update limits");
    }
  };

  const handleTimeout = async (hours: number) => {
    try {
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await onSaveControls({ coolingOffUntil: until });
      setFeedback(`Cooling-off activated until ${new Date(until).toLocaleString()}`);
      setTimeout(() => {
        setFeedback("");
        onOpenChange(false);
      }, 1800);
    } catch (err: any) {
      setFeedback(err.message || "Failed to activate timeout");
    }
  };

  const handleSelfExclude = async (days: number) => {
    try {
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await onSaveControls({ selfExcludedUntil: until });
      setFeedback(`Self-exclusion enforced until ${new Date(until).toLocaleDateString()}`);
      setTimeout(() => {
        setFeedback("");
        onOpenChange(false);
      }, 2000);
    } catch (err: any) {
      setFeedback(err.message || "Failed to self-exclude");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121715] border border-[#27312d] text-zinc-100 max-w-lg p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono font-bold flex items-center gap-2">
            <ShieldAlert className="text-lime-400" size={20} />
            Player Protection & Control
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Server-enforced gaming safeguards to ensure transparent, healthy play.
          </DialogDescription>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-[#0b0e0d] p-1 rounded-xl border border-zinc-800 text-xs font-mono mt-1">
          <button
            type="button"
            onClick={() => setTab("limits")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "limits" ? "bg-zinc-800 text-lime-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sliders size={14} /> Limits
          </button>
          <button
            type="button"
            onClick={() => setTab("timeout")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "timeout" ? "bg-zinc-800 text-lime-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Clock size={14} /> Time-Out
          </button>
          <button
            type="button"
            onClick={() => setTab("exclude")}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              tab === "exclude" ? "bg-zinc-800 text-red-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <AlertTriangle size={14} /> Exclusion
          </button>
        </div>

        {feedback && (
          <div className="p-3 bg-zinc-900 border border-lime-500/50 rounded-xl text-xs font-mono text-lime-300 flex items-center gap-2">
            <CheckCircle size={15} />
            {feedback}
          </div>
        )}

        {/* Tab 1: Limits */}
        {tab === "limits" && (
          <form onSubmit={handleSaveLimits} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-400">Daily Deposit Limit (KES)</label>
              <input
                type="number"
                placeholder="Leave blank for no limit"
                value={depositLimitKes}
                onChange={(e) => setDepositLimitKes(e.target.value)}
                className="bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-lime-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-400">Daily Wager Limit (KES)</label>
              <input
                type="number"
                placeholder="Leave blank for no limit"
                value={wagerLimitKes}
                onChange={(e) => setWagerLimitKes(e.target.value)}
                className="bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-lime-400"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 bg-lime-400 hover:bg-lime-300 text-black font-mono font-bold rounded-xl"
            >
              Save Limits
            </Button>
          </form>
        )}

        {/* Tab 2: Cooling-off / Time-out */}
        {tab === "timeout" && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Temporarily suspend your ability to place bets or make deposits. You can still withdraw your balance during cooling-off.
            </p>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleTimeout(1)}
                className="p-3 bg-[#0b0e0d] hover:bg-zinc-800 border border-zinc-800 hover:border-lime-500 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">1 Hour</div>
                <div className="text-[10px] text-zinc-500 mt-1">Quick break</div>
              </button>
              <button
                type="button"
                onClick={() => handleTimeout(24)}
                className="p-3 bg-[#0b0e0d] hover:bg-zinc-800 border border-zinc-800 hover:border-lime-500 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">24 Hours</div>
                <div className="text-[10px] text-zinc-500 mt-1">Full day</div>
              </button>
              <button
                type="button"
                onClick={() => handleTimeout(168)}
                className="p-3 bg-[#0b0e0d] hover:bg-zinc-800 border border-zinc-800 hover:border-lime-500 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">7 Days</div>
                <div className="text-[10px] text-zinc-500 mt-1">1 Week reset</div>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Self Exclusion */}
        {tab === "exclude" && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Self-exclusion is irreversible until the duration expires. Your account will be completely locked from all gaming activity.
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => handleSelfExclude(30)}
                className="p-3 bg-[#0b0e0d] hover:bg-red-950/40 border border-zinc-800 hover:border-red-600 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">30 Days</div>
                <div className="text-[10px] text-zinc-500 mt-1">1 Month</div>
              </button>
              <button
                type="button"
                onClick={() => handleSelfExclude(90)}
                className="p-3 bg-[#0b0e0d] hover:bg-red-950/40 border border-zinc-800 hover:border-red-600 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">90 Days</div>
                <div className="text-[10px] text-zinc-500 mt-1">3 Months</div>
              </button>
              <button
                type="button"
                onClick={() => handleSelfExclude(180)}
                className="p-3 bg-[#0b0e0d] hover:bg-red-950/40 border border-zinc-800 hover:border-red-600 rounded-xl text-center transition"
              >
                <div className="font-bold text-white text-sm">180 Days</div>
                <div className="text-[10px] text-zinc-500 mt-1">6 Months</div>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
