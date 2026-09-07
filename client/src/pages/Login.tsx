import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("player@aviator.local");
  const [password, setPassword] = useState("PlayerPass123!");
  const [displayName, setDisplayName] = useState("New Player");
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation({ onSuccess: () => navigate("/") });
  const register = trpc.auth.register.useMutation({
    onSuccess: () => navigate("/"),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const action =
      mode === "login"
        ? login.mutateAsync({ email, password })
        : register.mutateAsync({ email, password, displayName });
    action.catch(e => setError(e.message || "Unable to continue"));
  };
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <div className="brand-mark">A</div>
        <div>
          <p className="eyebrow">Aviator platform</p>
          <h1>Play with clarity.</h1>
        </div>
      </div>
      <Card className="auth-card">
        <CardHeader>
          <div className="icon-chip">
            <ShieldCheck size={18} />
          </div>
          <CardTitle>
            {mode === "login" ? "Player Sign In" : "Create a player account"}
          </CardTitle>
          <p className="muted">
            Consumer player gateway. Practice and sandbox gaming.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="stack">
            <label>
              Email
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            {mode === "register" && (
              <label>
                Display name
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Password
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                minLength={8}
                required
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <Button
              type="submit"
              className="primary-button"
              disabled={login.isPending || register.isPending}
            >
              {mode === "login" ? "Sign in to Play" : "Create Account"}
            </Button>
          </form>
          <button
            className="text-button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already registered? Sign in"}
          </button>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs font-mono">
            <Link href="/" className="back-link">
              <ArrowLeft size={14} /> Back to game
            </Link>
            <Link
              href="/admin/login"
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              Operations Desk ➔
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
