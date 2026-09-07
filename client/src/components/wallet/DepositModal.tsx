import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Smartphone, CreditCard, Landmark, Coins, CheckCircle, ShieldCheck } from "lucide-react";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit: (amountMinor: number, idempotencyKey: string) => Promise<any>;
  onDepositMpesa?: (amountKes: number, phone: string) => Promise<any>;
  isLoading?: boolean;
}

const METHODS = [
  { id: "mpesa", name: "M-Pesa Express", icon: Smartphone, subtitle: "Instant mobile money" },
  { id: "card", name: "Visa / Mastercard", icon: CreditCard, subtitle: "Card payment" },
  { id: "bank", name: "Bank Transfer", icon: Landmark, subtitle: "Direct EFT" },
  { id: "crypto", name: "Crypto (USDT)", icon: Coins, subtitle: "TRC20 / ERC20" },
];

const PRESETS = [250, 500, 1000, 2500, 5000];

export function DepositModal({
  open,
  onOpenChange,
  onDeposit,
  onDepositMpesa,
  isLoading,
}: DepositModalProps) {
  const [method, setMethod] = useState("mpesa");
  const [amountKes, setAmountKes] = useState("1000");
  const [phone, setPhone] = useState("254712345678");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const val = parseFloat(amountKes);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("Please enter a valid amount");
      return;
    }

    try {
      if (method === "mpesa" && onDepositMpesa) {
        await onDepositMpesa(val, phone);
        setSuccessMsg(
          `STK Push sent to ${phone}! Check your handset and enter your M-Pesa PIN.`
        );
      } else {
        const minor = Math.round(val * 100);
        await onDeposit(minor, crypto.randomUUID());
        setSuccessMsg(`Deposit of KES ${val.toLocaleString()} initiated successfully!`);
      }
      setTimeout(() => {
        setSuccessMsg("");
        onOpenChange(false);
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate deposit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121715] border border-[#27312d] text-zinc-100 max-w-md p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono font-bold flex items-center gap-2">
            <ShieldCheck className="text-lime-400" size={20} />
            Deposit Funds
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Instant deposit to your wallet ledger. Sandbox environment enabled.
          </DialogDescription>
        </DialogHeader>

        {successMsg ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle size={48} className="text-emerald-400 animate-bounce" />
            <p className="text-base font-mono font-bold text-emerald-300">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-lime-950/40 border-lime-500 text-white"
                        : "bg-[#0b0e0d] border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    <Icon size={18} className={isSelected ? "text-lime-400" : "text-zinc-500"} />
                    <div>
                      <div className="text-xs font-mono font-bold text-zinc-200">{m.name}</div>
                      <div className="text-[10px] text-zinc-500">{m.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* M-Pesa Phone Input if M-Pesa is selected */}
            {method === "mpesa" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-400">M-Pesa Mobile Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="2547XXXXXXXX"
                  className="bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-lime-400"
                />
              </div>
            )}

            {/* Amount input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-zinc-400">Amount to Deposit</label>
              <div className="flex items-center gap-2 bg-[#0b0e0d] border border-zinc-800 rounded-xl px-3 py-2.5 focus-within:border-lime-400">
                <span className="font-mono text-xs font-bold text-lime-400">KES</span>
                <input
                  type="number"
                  min="10"
                  value={amountKes}
                  onChange={(e) => setAmountKes(e.target.value)}
                  className="w-full bg-transparent font-mono text-base font-bold text-white text-right focus:outline-none"
                />
              </div>
            </div>

            {/* Amount Presets */}
            <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountKes(p.toString())}
                  className="py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 font-semibold transition"
                >
                  {p}
                </button>
              ))}
            </div>

            {errorMsg && (
              <p className="text-xs font-mono text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-800/50">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-12 bg-gradient-to-r from-lime-400 to-lime-500 hover:from-lime-300 hover:to-lime-400 text-zinc-950 font-mono font-extrabold text-sm rounded-xl shadow-lg shadow-lime-950/50"
            >
              {isLoading ? "Processing..." : `Deposit KES ${amountKes} Now`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
