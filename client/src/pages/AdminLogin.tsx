import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    adminLogin.mutate({ email: email.trim(), password });
  };

  return (
    <main className="min-h-screen bg-[#070a08] text-zinc-100 flex flex-col items-center justify-center p-4 font-sans">
      <Card className="w-full max-w-sm bg-[#0f1412] border border-[#232f29] rounded-2xl shadow-2xl">
        <CardHeader className="pb-2 text-center">
          <CardTitle className="text-xl font-bold text-white tracking-wide">
            Admin Login
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full h-11 px-3.5 bg-[#0b0e0d] border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full h-11 px-3.5 bg-[#0b0e0d] border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/70 focus:ring-1 focus:ring-red-500/40 transition"
              />
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
              className="w-full h-11 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {adminLogin.isPending ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
