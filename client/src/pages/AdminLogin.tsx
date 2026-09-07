import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, ArrowLeft, KeyRound, Lock, UserCheck, AlertTriangle } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("operator@aviator.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      navigate("/operations");
    },
    onError: (err) => {
      setError(err.message || "Failed to authenticate administrative credentials.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    adminLogin.mutate({ email, password });
  };

  const handleFillDemo = () => {
    setEmail("operator@aviator.local");
    setPassword("ChangeMe123!");
    setError("");
  };

  return (
    <main className="min-h-screen bg-[#070a08] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Subtle Background Radial Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-lime-950/15 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-6 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center font-mono font-black text-xl text-white shadow-lg shadow-red-950/50">
          A
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-white">
              Aviator <span className="text-red-400 font-extrabold">CONTROL DESK</span>
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
              Staff Anchor
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400">
            Authoritative Operations & Risk Gateway
          </p>
        </div>
      </div>

      {/* Auth Card */}
      <Card className="w-full max-w-md bg-[#0f1412] border border-[#232f29] rounded-2xl shadow-2xl backdrop-blur-xl z-10">
        <CardHeader className="pb-4 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-700/50 flex items-center justify-center text-red-400">
              <ShieldAlert size={20} />
            </div>
            <span className="text-[11px] font-mono text-zinc-400 bg-black/40 px-2.5 py-1 rounded-full border border-zinc-800">
              Restricted Access
            </span>
          </div>
          <CardTitle className="text-lg font-mono font-bold text-white mt-3">
            Administrative Sign In
          </CardTitle>
          <CardDescription className="text-xs font-mono text-zinc-400">
            Sign in with Compliance, Risk, Payments, or Super Admin credentials to access the back-office control room.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                <span>Staff Email</span>
                <span className="text-[11px] text-zinc-400">LDAP / Operator ID</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@aviator.local"
                  required
                  className="w-full h-11 px-3.5 bg-[#0b0e0d] border border-zinc-800 rounded-xl text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                <span>Security Key / Password</span>
                <span className="text-[11px] text-zinc-400">Min 8 characters</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full h-11 px-3.5 bg-[#0b0e0d] border border-zinc-800 rounded-xl text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-start gap-2 text-xs font-mono text-red-300">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={adminLogin.isPending}
              className="w-full h-12 bg-gradient-to-r from-red-600 via-red-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-mono font-bold text-sm rounded-xl shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <KeyRound size={16} />
              {adminLogin.isPending ? "Authenticating Clearance..." : "Authorize & Access Control Desk"}
            </Button>

            {/* Quick Demo Helper */}
            <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition"
              >
                <UserCheck size={14} className="text-lime-400" />
                Fill Default Operator Credentials (<code className="text-zinc-300">operator@aviator.local</code>)
              </button>
            </div>
          </form>

          {/* Navigation link to Player Portal */}
          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition">
              <ArrowLeft size={14} /> Return to Game Arena
            </Link>
            <Link href="/login" className="text-lime-400 hover:underline">
              Player Login Portal ➔
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
