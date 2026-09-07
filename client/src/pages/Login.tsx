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
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
        ? login.mutateAsync({ email: email.trim(), password })
        : register.mutateAsync({
            email: email.trim(),
            username: username.trim().toLowerCase(),
            password,
            displayName: displayName.trim() || username.trim(),
          });
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
            {mode === "register" && (
              <label>
                Username
                <input
                  value={username}
                  onChange={e =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="e.g. pilot_alex"
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_]{3,30}$"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  3-30 letters, numbers, or underscores. Shown on game leaderboards.
                </span>
              </label>
            )}
            <label>
              {mode === "login" ? "Email or Username" : "Email"}
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type={mode === "login" ? "text" : "email"}
                placeholder={
                  mode === "login" ? "pilot_alex or user@example.com" : "user@example.com"
                }
                required
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <Button
              type="submit"
              className="primary-button"
              disabled={login.isPending || register.isPending}
            >
              {login.isPending || register.isPending
                ? "Processing..."
                : mode === "login"
                  ? "Sign in to Play"
                  : "Create Account"}
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
