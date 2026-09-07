import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldCheck, Hash, Key, Check, Copy } from "lucide-react";

interface ProvablyFairModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  round?: {
    roundNumber?: number;
    commitment?: string;
    seed?: string;
    crashMultiplier?: number;
  } | null;
}

export function ProvablyFairModal({
  open,
  onOpenChange,
  round,
}: ProvablyFairModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121715] border border-[#27312d] text-zinc-100 max-w-lg p-6 rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-mono font-bold flex items-center gap-2">
            <ShieldCheck className="text-lime-400" size={20} />
            Provably Fair Verification
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Every round multiplier is cryptographically pre-generated before flight. Results cannot be manipulated during the round.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2 text-xs font-mono">
          {/* Commitment Hash */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1">
                <Hash size={13} /> SHA-256 Public Commitment
              </span>
              {round?.commitment && (
                <button
                  type="button"
                  onClick={() => handleCopy(round.commitment!)}
                  className="text-lime-400 flex items-center gap-1 hover:underline"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <div className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-3 break-all text-zinc-300 select-all">
              {round?.commitment || "Generated at round creation"}
            </div>
          </div>

          {/* Seed */}
          <div className="flex flex-col gap-1.5">
            <span className="text-zinc-400 flex items-center gap-1">
              <Key size={13} /> Server Secret Seed
            </span>
            <div className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-3 break-all text-zinc-400">
              {round?.seed ? round.seed : "Revealed upon round crash & settlement"}
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-3.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-300 leading-relaxed font-sans text-xs">
            <p className="font-semibold text-lime-400 font-mono mb-1">How Verification Works:</p>
            1. Before takeoff, the server hashes the secret seed with <code>SHA-256</code> to generate the public commitment.<br />
            2. The crash multiplier is calculated deterministically from the hash bytes.<br />
            3. After crash, the seed is revealed so any player can independently verify that <code>SHA256(seed) === commitment</code>.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
