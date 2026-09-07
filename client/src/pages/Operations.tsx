import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
  Activity,
  Clock3,
  CheckCircle2,
  XCircle,
  Download,
  Filter,
  FileText,
  AlertTriangle,
  PlayCircle,
  Eye,
  Smartphone,
  Send,
  RefreshCw,
  Key,
  Settings,
  Zap,
} from "lucide-react";

const money = (minor: number) =>
  `KES ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csvContent =
    "data:text/csv;charset=utf-8," +
    [
      keys.join(","),
      ...rows.map((row) =>
        keys
          .map((k) => {
            const cell = row[k] === null || row[k] === undefined ? "" : String(row[k]);
            return `"${cell.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function Operations() {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const allowedRoles = [
    "ADMIN",
    "SUPER_ADMIN",
    "COMPLIANCE_OFFICER",
    "RISK_ANALYST",
    "PAYMENTS_OPERATOR",
    "SUPPORT",
  ];
  const isAuthorized = Boolean(user && allowedRoles.includes(user.role));

  // Queries (only fired if authorized)
  const overview = trpc.operations.overview.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const users = trpc.operations.users.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const withdrawals = trpc.operations.withdrawals.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const audit = trpc.operations.audit.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const rounds = trpc.operations.rounds.useQuery(undefined, {
    enabled: isAuthorized,
    refetchInterval: 2500,
  });
  const wallets = trpc.operations.wallets.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const ledger = trpc.operations.ledger.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const deposits = trpc.operations.deposits.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const bets = trpc.operations.bets.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const risk = trpc.operations.risk.useQuery(undefined, {
    enabled: isAuthorized,
  });

  // Daraja Gateway Queries & Mutations
  const darajaConfig = trpc.operations.darajaConfig.useQuery(undefined, {
    enabled: isAuthorized,
  });
  const darajaPrompts = trpc.operations.darajaPrompts.useQuery(undefined, {
    enabled: isAuthorized,
    refetchInterval: 3000,
  });
  const updateDaraja = trpc.operations.updateDarajaConfig.useMutation({
    onSuccess: () => {
      darajaConfig.refetch();
      setDarajaSavedMsg("Daraja configuration successfully saved!");
      setTimeout(() => setDarajaSavedMsg(""), 3500);
    },
  });
  const testDaraja = trpc.operations.testDarajaPrompt.useMutation({
    onSuccess: (data) => {
      setTestPromptResult(data);
      darajaPrompts.refetch();
      setTestPromptError("");
    },
    onError: (err) => {
      setTestPromptError(err.message || "Failed to trigger STK push prompt.");
      setTestPromptResult(null);
    },
  });

  // Mutation for withdrawal state transitions
  const transitionWithdrawal = trpc.operations.approveWithdrawal.useMutation({
    onSuccess: () => {
      withdrawals.refetch();
      overview.refetch();
      wallets.refetch();
      ledger.refetch();
    },
  });

  // Filters & State
  const [activeTab, setActiveTab] = useState<
    "all" | "withdrawals" | "players" | "ledger" | "rounds" | "daraja"
  >("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // Daraja Config Form State
  const [darajaEnabled, setDarajaEnabled] = useState(true);
  const [darajaEnv, setDarajaEnv] = useState<"sandbox" | "production">("sandbox");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [shortcode, setShortcode] = useState("174379");
  const [callbackUrl, setCallbackUrl] = useState("http://localhost:3000/api/webhooks/daraja");
  const [darajaSavedMsg, setDarajaSavedMsg] = useState("");

  // Prompt a User Form State
  const [testPhone, setTestPhone] = useState("254712345678");
  const [testAmount, setTestAmount] = useState("100");
  const [testAccountRef, setTestAccountRef] = useState("AviatorAdmin");
  const [selectedPromptUser, setSelectedPromptUser] = useState("");
  const [testPromptResult, setTestPromptResult] = useState<any>(null);
  const [testPromptError, setTestPromptError] = useState("");

  useEffect(() => {
    if (darajaConfig.data) {
      setDarajaEnabled(darajaConfig.data.enabled);
      setDarajaEnv(darajaConfig.data.environment);
      setConsumerKey(darajaConfig.data.consumerKey || "");
      setConsumerSecret(darajaConfig.data.consumerSecret || "");
      setPasskey(darajaConfig.data.passkey || "");
      setShortcode(darajaConfig.data.shortcode || "174379");
      setCallbackUrl(darajaConfig.data.callbackUrl || "");
    }
  }, [darajaConfig.data]);

  const filteredUsers = (users.data || []).filter(
    (item) =>
      `${item.displayName} ${item.email}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (statusFilter === "ALL" ||
        item.riskStatus === statusFilter ||
        item.kycStatus === statusFilter)
  );

  useEffect(() => {
    if (!loading && (!user || !isAuthorized)) {
      navigate("/admin/login");
    }
  }, [loading, user, isAuthorized, navigate]);

  if (loading || !user || !isAuthorized) {
    return (
      <main className="min-h-screen bg-[#070a08] text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-950/50 border border-red-800 flex items-center justify-center text-red-400">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-mono font-bold">
            Administrative Clearance Required
          </h2>
          <p className="text-xs font-mono text-zinc-400 max-w-sm">
            You must be signed in with an authorized operations role (Admin,
            Risk, Compliance, Payments) to view this desk.
          </p>
          <Button
            onClick={() => navigate("/admin/login")}
            className="mt-2 bg-red-600 hover:bg-red-500 font-mono text-xs font-bold"
          >
            Go to Admin Login Portal
          </Button>
        </div>
      </main>
    );
  }

  const handleApprove = (id: string) => {
    transitionWithdrawal.mutate({
      withdrawalId: id,
      nextStatus: "APPROVED",
    });
  };

  const handleComplete = (id: string) => {
    transitionWithdrawal.mutate({
      withdrawalId: id,
      nextStatus: "COMPLETED",
    });
  };

  const openRejectModal = (id: string) => {
    setRejectTargetId(id);
    setRejectReason("Compliance or verification check pending");
    setRejectModalOpen(true);
  };

  const confirmReject = () => {
    if (!rejectTargetId) return;
    transitionWithdrawal.mutate({
      withdrawalId: rejectTargetId,
      nextStatus: "REJECTED",
      reason: rejectReason,
    });
    setRejectModalOpen(false);
    setRejectTargetId("");
  };

  return (
    <main className="ops-shell min-h-screen bg-[#0b0e0d] text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <header className="ops-topbar">
        <Link href="/" className="back-link flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white">
          <ArrowLeft size={15} /> Back to Player Game
        </Link>
        <div className="ops-title flex items-center gap-2 font-mono font-bold text-sm">
          <span className="live-dot" />
          Aviator Operations Command Center
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-lime-500/50 text-lime-400">
            {user.role}
          </Badge>
        </div>
      </header>

      <div className="ops-content p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Intro Header */}
        <div className="page-intro flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-xs font-mono uppercase tracking-widest text-lime-400 font-bold">
              Authoritative Platform Governance
            </p>
            <h1 className="text-2xl font-mono font-extrabold text-white">Operations & Compliance Desk</h1>
            <p className="muted text-xs text-zinc-400 mt-0.5">
              Live double-entry ledger verification, withdrawal approval queue, risk triage, and round telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                overview.refetch();
                withdrawals.refetch();
                ledger.refetch();
                rounds.refetch();
              }}
              className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-mono text-xs flex items-center gap-1.5"
            >
              <Activity size={14} /> Refresh Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv("ledger_audit", ledger.data || [])}
              className="border-zinc-800 hover:bg-zinc-800 text-lime-400 font-mono text-xs flex items-center gap-1.5"
            >
              <Download size={14} /> Export Ledger CSV
            </Button>
          </div>
        </div>

        {/* High-Level Metric Tiles */}
        <section className="metric-grid grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#121715] border-[#27312d]">
            <CardContent className="metric-card p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-mono">Registered Players</span>
                <Users size={16} className="text-lime-400" />
              </div>
              <strong className="text-2xl font-mono font-bold text-white">
                {overview.data?.users ?? "—"}
              </strong>
            </CardContent>
          </Card>
          <Card className="bg-[#121715] border-[#27312d]">
            <CardContent className="metric-card p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-mono">Pending Withdrawals</span>
                <WalletCards size={16} className="text-orange-400" />
              </div>
              <strong className="text-2xl font-mono font-bold text-orange-400">
                {overview.data?.pendingWithdrawals ?? 0}
              </strong>
            </CardContent>
          </Card>
          <Card className="bg-[#121715] border-[#27312d]">
            <CardContent className="metric-card p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-mono">Provider Integrity</span>
                <ShieldCheck size={16} className="text-emerald-400" />
              </div>
              <strong className="text-2xl font-mono font-bold text-emerald-400">
                {overview.data?.sandboxMode ? "Sandbox Safe" : "Production"}
              </strong>
            </CardContent>
          </Card>
          <Card className="bg-[#121715] border-[#27312d]">
            <CardContent className="metric-card p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-xs font-mono">Ledger Postings</span>
                <Clock3 size={16} className="text-purple-400" />
              </div>
              <strong className="text-2xl font-mono font-bold text-purple-300">
                {overview.data?.ledgerEntries ?? "—"}
              </strong>
            </CardContent>
          </Card>
        </section>

        {/* Navigation Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "all" ? "bg-zinc-800 text-lime-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            All Panes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("withdrawals")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "withdrawals" ? "bg-zinc-800 text-orange-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Withdrawal Approvals ({withdrawals.data?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("players")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "players" ? "bg-zinc-800 text-lime-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Players & Risk
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "ledger" ? "bg-zinc-800 text-purple-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Double-Entry Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rounds")}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === "rounds" ? "bg-zinc-800 text-emerald-400 font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Round Telemetry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("daraja")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "daraja"
                ? "bg-zinc-800 text-lime-400 font-bold border border-lime-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Smartphone size={14} className="text-lime-400" />
            Daraja M-Pesa Gateway
          </button>
        </div>

        {/* Section 1: ACTIONABLE WITHDRAWAL QUEUE */}
        {(activeTab === "all" || activeTab === "withdrawals") && (
          <Card className="table-card bg-[#121715] border-[#27312d]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <WalletCards size={18} className="text-orange-400" />
                  Actionable Withdrawal Queue
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Review and transition player payouts. Approvals post balanced double-entry settlement legs.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {withdrawals.data?.length || 0} Total Requests
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                      <th className="py-2.5 px-3">ID / Reference</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Requested At</th>
                      <th className="py-2.5 px-3 text-right">Operator Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(withdrawals.data || []).map((item) => (
                      <tr key={item.id} className="border-b border-zinc-900/80 hover:bg-zinc-900/30">
                        <td className="py-3 px-3 font-semibold text-zinc-300">
                          {item.id.slice(0, 8)}…
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          {money(item.amountMinor)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-400"
                                : item.status === "APPROVED"
                                ? "bg-blue-950/60 border-blue-700/60 text-blue-400"
                                : item.status === "REJECTED"
                                ? "bg-red-950/60 border-red-700/60 text-red-400"
                                : "bg-amber-950/60 border-amber-700/60 text-amber-300"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-400">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.status === "REQUESTED" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(item.id)}
                                disabled={transitionWithdrawal.isPending}
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openRejectModal(item.id)}
                                disabled={transitionWithdrawal.isPending}
                                className="h-7 px-2.5 bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-red-700/50"
                              >
                                <XCircle size={12} /> Reject
                              </Button>
                            </div>
                          )}
                          {item.status === "APPROVED" && (
                            <Button
                              size="sm"
                              onClick={() => handleComplete(item.id)}
                              disabled={transitionWithdrawal.isPending}
                              className="h-7 px-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                            >
                              <PlayCircle size={12} /> Complete Payout
                            </Button>
                          )}
                          {item.status !== "REQUESTED" && item.status !== "APPROVED" && (
                            <span className="text-zinc-500 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!(withdrawals.data || []).length && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-zinc-500 font-mono text-xs">
                          No withdrawal requests pending in the queue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 2: PLAYER REGISTRY & RISK QUEUE */}
        {(activeTab === "all" || activeTab === "players") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <Users size={18} className="text-lime-400" />
                  Player Accounts Directory
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#0b0e0d] border border-zinc-800 rounded-lg px-2.5 py-1">
                    <Search size={13} className="text-zinc-500" />
                    <input
                      placeholder="Search email or name"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="bg-transparent text-xs font-mono text-white focus:outline-none w-36 sm:w-44"
                    />
                  </div>
                  <select
                    className="ops-filter bg-[#0b0e0d] border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg px-2 py-1 focus:outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All KYC/Risk</option>
                    <option value="CLEAR">Clear</option>
                    <option value="REVIEW">Review</option>
                    <option value="VERIFIED">KYC Verified</option>
                    <option value="PENDING">KYC Pending</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                        <th className="py-2.5 px-3">Player</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">KYC</th>
                        <th className="py-2.5 px-3">Risk Status</th>
                        <th className="py-2.5 px-3 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.slice(0, 10).map((item) => (
                        <tr key={item.id} className="border-b border-zinc-900/80 hover:bg-zinc-900/30">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-zinc-200">{item.displayName}</div>
                            <div className="text-[10px] text-zinc-500">{item.email}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] border-zinc-700">
                              {item.role}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                item.kycStatus === "VERIFIED" ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {item.kycStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                item.riskStatus === "CLEAR"
                                  ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                                  : "bg-red-950/40 border-red-800/50 text-red-400"
                              }`}
                            >
                              {item.riskStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedPlayer(item)}
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                            >
                              <Eye size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Risk Queue */}
            <Card className="table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400" />
                  Active Risk Flags
                </CardTitle>
                <p className="text-xs text-zinc-400">Accounts triggered by threshold rules</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {(risk.data || []).slice(0, 6).map((item: any) => (
                    <div
                      key={item.userId}
                      className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-amber-300">{item.email}</div>
                        <div className="text-[10px] text-zinc-500">KYC: {item.kycStatus}</div>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-600/40">
                        {item.riskStatus}
                      </Badge>
                    </div>
                  ))}
                  {!(risk.data || []).length && (
                    <div className="text-center py-6 text-xs font-mono text-zinc-500">
                      No high-risk accounts currently flagged.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Section 3: DOUBLE-ENTRY LEDGER & AUDIT TRAIL */}
        {(activeTab === "all" || activeTab === "ledger") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="flex items-center justify-between pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <Clock3 size={18} className="text-purple-400" />
                  Balanced Double-Entry Ledger
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportToCsv("ledger_entries", ledger.data || [])}
                  className="h-7 text-xs font-mono border-zinc-800 text-zinc-300"
                >
                  <Download size={12} className="mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledger.data || []).slice(0, 8).map((item: any) => (
                        <tr key={item.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/20">
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">
                            {item.type}
                          </td>
                          <td
                            className={`py-2.5 px-3 font-bold ${
                              item.amountMinor > 0 ? "text-emerald-400" : "text-zinc-300"
                            }`}
                          >
                            {money(item.amountMinor)}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 truncate max-w-[140px]">
                            {item.reference}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="flex items-center justify-between pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  Authoritative Audit Trail
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportToCsv("audit_trail", audit.data || [])}
                  className="h-7 text-xs font-mono border-zinc-800 text-zinc-300"
                >
                  <Download size={12} className="mr-1" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {(audit.data || []).slice(0, 8).map((item: any) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#0b0e0d] border border-zinc-800/80 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-lime-400" />
                        <span className="font-bold text-zinc-200">{item.action}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Section 4: ROUND TELEMETRY & BET FLOW */}
        {(activeTab === "all" || activeTab === "rounds") && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <Activity size={18} className="text-lime-400" />
                  Live Round Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                      <th className="py-2 px-3">Round</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rounds.data || []).slice(0, 6).map((item: any) => (
                      <tr key={item.id} className="border-b border-zinc-900/60">
                        <td className="py-2.5 px-3 font-semibold">#{item.roundNumber}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-lime-400">
                          {item.crashMultiplier ? `${item.crashMultiplier}x` : `${item.multiplier || 1.0}x`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="table-card bg-[#121715] border-[#27312d]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-lime-400" />
                  Recent Bet Settlements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Stake</th>
                      <th className="py-2 px-3">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bets.data || []).slice(0, 6).map((item: any) => (
                      <tr key={item.id} className="border-b border-zinc-900/60">
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{money(item.stakeMinor)}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">
                          {item.payoutMinor ? money(item.payoutMinor) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Section 5: M-PESA DARAJA API GATEWAY & USER PROMPT CONTROLS */}
        {(activeTab === "all" || activeTab === "daraja") && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Configurable Daraja Gateway Parameters */}
              <Card className="bg-[#121715] border-[#27312d] shadow-xl">
                <CardHeader className="pb-3 border-b border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                      <Settings size={18} className="text-lime-400" />
                      Daraja API Configuration
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono font-bold ${
                        darajaEnabled
                          ? darajaEnv === "production"
                            ? "bg-red-950/60 text-red-400 border-red-800"
                            : "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {darajaEnabled
                        ? darajaEnv === "production"
                          ? "LIVE PRODUCTION"
                          : "SANDBOX TESTBED"
                        : "GATEWAY DISABLED"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs font-mono text-zinc-400">
                    Configure Safaricom Lipa na M-Pesa Online STK Push parameters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-3 text-xs font-mono">
                  {darajaSavedMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      {darajaSavedMsg}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e0d] border border-zinc-800">
                    <div>
                      <span className="font-bold text-white block">Gateway Status</span>
                      <span className="text-[11px] text-zinc-400">Enable or disable STK Push prompt gateway</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={darajaEnabled}
                        onChange={(e) => setDarajaEnabled(e.target.checked)}
                        className="accent-[#c9f36b] w-4 h-4 rounded cursor-pointer"
                      />
                      <span className={darajaEnabled ? "text-lime-400 font-bold" : "text-zinc-500"}>
                        {darajaEnabled ? "Active" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400">Environment</label>
                      <select
                        value={darajaEnv}
                        onChange={(e: any) => setDarajaEnv(e.target.value)}
                        className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                      >
                        <option value="sandbox">Sandbox (Testbed)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400">Business Shortcode (Paybill/Till)</label>
                      <input
                        type="text"
                        value={shortcode}
                        onChange={(e) => setShortcode(e.target.value)}
                        placeholder="174379"
                        className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400 font-mono"
                      >
                      </input>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400">Consumer Key</label>
                    <input
                      type="text"
                      value={consumerKey}
                      onChange={(e) => setConsumerKey(e.target.value)}
                      placeholder="Enter Safaricom Consumer Key"
                      className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400">Consumer Secret</label>
                    <input
                      type="password"
                      value={consumerSecret}
                      onChange={(e) => setConsumerSecret(e.target.value)}
                      placeholder="Enter Consumer Secret"
                      className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400">Lipa Na M-Pesa Online Passkey</label>
                    <input
                      type="password"
                      value={passkey}
                      onChange={(e) => setPasskey(e.target.value)}
                      placeholder="Enter Passkey"
                      className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400">Callback / Webhook URL</label>
                    <input
                      type="text"
                      value={callbackUrl}
                      onChange={(e) => setCallbackUrl(e.target.value)}
                      placeholder="https://your-domain.com/api/webhooks/daraja"
                      className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                    />
                  </div>

                  <Button
                    type="button"
                    disabled={updateDaraja.isPending}
                    onClick={() =>
                      updateDaraja.mutate({
                        enabled: darajaEnabled,
                        environment: darajaEnv,
                        consumerKey,
                        consumerSecret,
                        passkey,
                        shortcode,
                        callbackUrl,
                      })
                    }
                    className="mt-2 bg-gradient-to-r from-lime-500 to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-mono font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Settings size={14} />
                    {updateDaraja.isPending ? "Saving..." : "Save Daraja Configuration"}
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Interactive Prompt User Dispatcher */}
              <Card className="bg-[#121715] border-[#27312d] shadow-xl flex flex-col justify-between">
                <div>
                  <CardHeader className="pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                        <Smartphone size={18} className="text-lime-400" />
                        Prompt a User (STK Push)
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono text-lime-400 border-lime-800 bg-lime-950/40">
                        Live Dispatcher
                      </Badge>
                    </div>
                    <CardDescription className="text-xs font-mono text-zinc-400">
                      Send an instant STK Push prompt to a user's mobile device to trigger PIN entry.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 flex flex-col gap-3 text-xs font-mono">
                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400">Select Registered Player (Optional)</label>
                      <select
                        value={selectedPromptUser}
                        onChange={(e) => {
                          setSelectedPromptUser(e.target.value);
                          const chosen = users.data?.find((u) => u.id === e.target.value);
                          if (chosen) setTestAccountRef(chosen.displayName.slice(0, 10));
                        }}
                        className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                      >
                        <option value="">-- Custom Phone Prompt --</option>
                        {(users.data || []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-zinc-400">Target Phone Number</label>
                      <input
                        type="text"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="2547XXXXXXXX or 07XXXXXXXX"
                        className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                      />
                      <span className="text-[10px] text-zinc-500">Formats accepted: 2547..., 07..., 2541...</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-zinc-400">Amount (KES)</label>
                        <input
                          type="number"
                          min="1"
                          value={testAmount}
                          onChange={(e) => setTestAmount(e.target.value)}
                          className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400 font-bold text-lime-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-zinc-400">Account Reference</label>
                        <input
                          type="text"
                          value={testAccountRef}
                          onChange={(e) => setTestAccountRef(e.target.value)}
                          placeholder="AviatorRef"
                          maxLength={12}
                          className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-lime-400"
                        />
                      </div>
                    </div>

                    {testPromptError && (
                      <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-400 shrink-0" />
                        <span>{testPromptError}</span>
                      </div>
                    )}

                    {testPromptResult && (
                      <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center gap-2 font-bold text-emerald-400">
                          <CheckCircle2 size={16} />
                          STK Push Dispatched Successfully!
                        </div>
                        <div className="text-[11px] text-zinc-300">
                          {testPromptResult.customerMessage}
                        </div>
                        <div className="pt-1.5 border-t border-emerald-900/60 text-[10px] font-mono text-zinc-400 flex flex-col gap-0.5">
                          <span>Checkout ID: <code className="text-lime-300">{testPromptResult.checkoutRequestId}</code></span>
                          <span>Merchant ID: <code className="text-zinc-300">{testPromptResult.merchantRequestId}</code></span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>

                <div className="p-6 pt-0">
                  <Button
                    type="button"
                    disabled={testDaraja.isPending}
                    onClick={() => {
                      setTestPromptError("");
                      setTestPromptResult(null);
                      testDaraja.mutate({
                        phoneNumber: testPhone,
                        amountKes: parseFloat(testAmount) || 100,
                        accountReference: testAccountRef,
                        userId: selectedPromptUser || undefined,
                      });
                    }}
                    className="w-full h-11 bg-gradient-to-r from-red-600 via-amber-600 to-lime-600 hover:from-red-500 hover:to-lime-500 text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <Send size={14} />
                    {testDaraja.isPending ? "Sending STK Prompt..." : "Prompt User with STK Push 🚀"}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Prompts Log Table */}
            <Card className="bg-[#121715] border-[#27312d]">
              <CardHeader className="pb-3 border-b border-zinc-800 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-mono font-bold text-white flex items-center gap-2">
                  <Clock3 size={18} className="text-lime-400" />
                  Recent Daraja STK Push Transactions ({darajaPrompts.data?.length || 0})
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => darajaPrompts.refetch()}
                  className="border-zinc-800 text-zinc-300 font-mono text-xs flex items-center gap-1.5 h-8"
                >
                  <RefreshCw size={12} /> Refresh
                </Button>
              </CardHeader>
              <CardContent className="pt-3">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Checkout Request ID</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Result / Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(darajaPrompts.data || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-zinc-500">
                          No STK prompts dispatched yet. Use the prompt tester above to send a prompt.
                        </td>
                      </tr>
                    ) : (
                      darajaPrompts.data?.map((item) => (
                        <tr key={item.id} className="border-b border-zinc-900/60 hover:bg-zinc-900/30">
                          <td className="py-2.5 px-3 text-zinc-400">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {item.phoneNumber}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-lime-400">
                            KES {item.amountKes.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400">
                            <code className="text-[11px]">{item.checkoutRequestId}</code>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                item.status === "COMPLETED"
                                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-400"
                                  : item.status === "FAILED"
                                  ? "border-red-800 bg-red-950/40 text-red-400"
                                  : "border-amber-800 bg-amber-950/40 text-amber-300"
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300">
                            {item.mpesaReceipt ? (
                              <span className="font-bold text-emerald-400">{item.mpesaReceipt}</span>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">{item.resultDesc}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Reject Withdrawal Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="bg-[#121715] border border-red-900/60 text-zinc-100 max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono font-bold text-red-400 flex items-center gap-2">
              <XCircle size={20} /> Reject Withdrawal Request
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Provide an audit reason for rejecting this payout. The funds will be released from reservation back to the player's available ledger balance.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-3">
            <label className="text-xs font-mono text-zinc-400">Rejection Audit Reason</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="bg-[#0b0e0d] border border-zinc-800 rounded-xl p-3 font-mono text-xs text-white focus:outline-none focus:border-red-500 h-24"
              placeholder="Enter compliance reason..."
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectModalOpen(false)}
                className="border-zinc-800 text-zinc-300 font-mono text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmReject}
                className="bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Detail Drawer Dialog */}
      <Dialog open={Boolean(selectedPlayer)} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <DialogContent className="bg-[#121715] border border-zinc-800 text-zinc-100 max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-mono font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-lime-400" />
              Player Account Overview
            </DialogTitle>
          </DialogHeader>
          {selectedPlayer && (
            <div className="flex flex-col gap-3 mt-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">Display Name</span>
                <span className="font-bold text-white">{selectedPlayer.displayName}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">Email Address</span>
                <span className="text-zinc-200">{selectedPlayer.email}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">Account Role</span>
                <Badge variant="outline">{selectedPlayer.role}</Badge>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">KYC Status</span>
                <span className="font-bold text-emerald-400">{selectedPlayer.kycStatus}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">Risk Assessment</span>
                <span className="font-bold text-lime-400">{selectedPlayer.riskStatus}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-[#0b0e0d] border border-zinc-800">
                <span className="text-zinc-400">Created At</span>
                <span className="text-zinc-400">{new Date(selectedPlayer.createdAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
