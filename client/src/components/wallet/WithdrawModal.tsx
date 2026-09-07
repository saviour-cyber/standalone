import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowUpRight, CheckCircle, AlertCircle, Wallet } from "lucide-react";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMinor: number;
  onWithdraw: (amountMinor: number) => Promise<any>;
  isLoading?: boolean;
}

export function WithdrawModal({
  open,
  onOpenChange,
  availableMinor,
  onWithdraw,
  isLoading,
}: WithdrawModalProps) {
  const [amountKes, setAmountKes] = useState("500");
  const [destination, setDestination] = useState("254712345678");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const availableKes = (availableMinor / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const val = parseFloat(amountKes);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Please enter a valid withdrawal amount");
      return;
    }

    if (val > availableKes) {
      setErrorMsg(`Amount exceeds available balance of KES ${availableKes.toFixed(2)}`);
      return;
    }

    try {
      const minor = Math.round(val * 100);
      await onWithdraw(minor);
      setSuccessMsg(`Withdrawal request of KES ${val.toLocaleString()} submitted for review!`);
      setTimeout(() => {
        setSuccessMsg("");
        onOpenChange(false);
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit withdrawal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121715] border border-[#27312d] text-zinc-100 max-w-md p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono font-bold flex items-center gap-2">
            <Wallet className="text-orange-400" size={20} />
            Request Withdrawal
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Transfer funds from your available ledger balance to your mobile or bank account.
          </DialogDescription>
        </DialogHeader>

        {successMsg ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle size={48} className="text-emerald-400 animate-bounce" />
            <p className="text-base font-mono font-bold text-emerald-300">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* Available Balance Reminder */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e0d] border border-zinc-800">
              <span className="text-xs font-mono text-zinc-400">Available to Withdraw</span>
              <span className="text-sm font-mono font-bold text-lime-400">
                KES {availableKes.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-400">Destination M-Pesa / Account</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="2547XXXXXXXX"
                className="bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-lime-400"
                required
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-zinc-400">Withdrawal Amount</label>
                <button
                  type="button"
                  onClick={() => setAmountKes(availableKes.toFixed(0))}
                  className="text-[11px] font-mono text-lime-400 hover:underline"
                >
                  Max Available
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-lime-400">
                <span className="font-mono text-xs font-bold text-orange-400">KES</span>
                <input
                  type="number"
                  min="50"
                  value={amountKes}
                  onChange={(e) => setAmountKes(e.target.value)}
                  className="w-full bg-transparent font-mono text-base font-bold text-white text-right focus:outline-none"
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-mono text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/50 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading || availableKes <= 0}
              className="mt-2 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-mono font-extrabold text-sm rounded-xl shadow-lg shadow-orange-950/50"
            >
              {isLoading ? "Submitting..." : `Withdraw KES ${amountKes}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
