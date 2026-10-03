import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminOverviewMetrics,
  getAdminRegistrations,
  getAdminOrders,
  getAdminRegistrationDetail,
  exportRegistrationsCsvData,
  exportOrdersCsvData,
} from "@/lib/admin.functions";
import {
  Users,
  PlayCircle,
  Video,
  Sparkles,
  CreditCard,
  CheckCircle2,
  IndianRupee,
  Search,
  Download,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Laptop,
  Eye,
  X,
  AlertCircle,
  Clock,
  Check,
  Copy,
  Layers,
  ArrowUpRight,
  BarChart3,
  HelpCircle,
  Lock,
  Mail,
  Key,
  Menu,
  ShieldAlert,
} from "lucide-react";

export function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "orders" | "settings">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Secure Supabase Auth Session Listener (Zero hardcoded keys / zero URL param auth)
  useEffect(() => {
    // 1. Fetch current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020604] text-emerald-400">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm tracking-wide text-zinc-400">Verifying secure admin session...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.access_token) {
    return <AdminLoginForm onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const authToken = session.access_token;
  const userEmail = session.user?.email || "Admin User";

  return (
    <div className="flex min-h-screen bg-[#020604] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-emerald-950/60 bg-[#040d08]/95 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-0 -translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-emerald-950/60 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-white">PENDUGPT</span>
                <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                  ADMIN
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Control & Analytics</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-zinc-400 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1.5 p-4">
          <button
            onClick={() => {
              setActiveTab("overview");
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
              activeTab === "overview"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "text-zinc-400 hover:bg-emerald-950/40 hover:text-zinc-200"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Overview
          </button>

          <button
            onClick={() => {
              setActiveTab("registrations");
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
              activeTab === "registrations"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "text-zinc-400 hover:bg-emerald-950/40 hover:text-zinc-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Registrations
          </button>

          <button
            onClick={() => {
              setActiveTab("orders");
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
              activeTab === "orders"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "text-zinc-400 hover:bg-emerald-950/40 hover:text-zinc-200"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Orders & Revenue
          </button>

          <button
            onClick={() => {
              setActiveTab("settings");
              setSidebarOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
              activeTab === "settings"
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                : "text-zinc-400 hover:bg-emerald-950/40 hover:text-zinc-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Settings & System
          </button>
        </nav>

        {/* User Card & Logout */}
        <div className="border-t border-emerald-950/60 p-4">
          <div className="mb-3 rounded-lg bg-emerald-950/30 p-2.5 border border-emerald-900/40">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="truncate text-xs font-medium text-zinc-200" title={userEmail}>
                {userEmail}
              </p>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-500">Supabase Auth Session</p>
          </div>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/30 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/50 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-emerald-950/60 bg-[#030906]/80 px-4 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-emerald-900/40 p-2 text-zinc-400 hover:text-white md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold capitalize text-zinc-100 md:text-lg">
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "registrations" && "Funnel Registrations"}
              {activeTab === "orders" && "Orders & Payments"}
              {activeTab === "settings" && "System Configuration"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-900/50 hover:text-emerald-300"
            >
              <span>Live Site</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* Tab Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "overview" && <AdminOverviewTab authToken={authToken} onNavigate={setActiveTab} onSignOut={handleSignOut} />}
          {activeTab === "registrations" && <AdminRegistrationsTab authToken={authToken} onSignOut={handleSignOut} />}
          {activeTab === "orders" && <AdminOrdersTab authToken={authToken} onSignOut={handleSignOut} />}
          {activeTab === "settings" && <AdminSettingsTab userEmail={userEmail} onSignOut={handleSignOut} />}
        </main>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * LOGIN SCREEN COMPONENT (Supabase Auth Email + Password Only)
 * ============================================================================
 */
function AdminLoginForm({ onLoginSuccess }: { onLoginSuccess: (session: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSetupHelp, setShowSetupHelp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        onLoginSuccess(data.session);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid administrator credentials. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020604] p-4 text-zinc-100 selection:bg-emerald-500/30">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">PenduGPT Admin</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Private management portal. Supabase authenticated administrators only.
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-xl border border-emerald-950/80 bg-[#040d08]/90 p-6 shadow-2xl backdrop-blur-md">
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300">Admin Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pendugpt.com"
                  className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300">Password</label>
              <div className="relative mt-1.5">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Setup Guide Accordion */}
          <div className="mt-6 border-t border-emerald-950/60 pt-4 text-center">
            <button
              type="button"
              onClick={() => setShowSetupHelp(!showSetupHelp)}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>How to authorize or create an administrator?</span>
            </button>

            {showSetupHelp && (
              <div className="mt-3 rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3 text-left text-xs leading-relaxed text-zinc-300">
                <p className="font-semibold text-emerald-400">Step 1: Open Supabase Authentication</p>
                <p className="mt-1 text-zinc-400">
                  Open your Supabase project (<code>xlyqrzcstkxdkyvdensc</code>) → <strong>Authentication</strong> → <strong>Users</strong>.
                </p>
                <p className="mt-2 font-semibold text-emerald-400">Step 2: Create Admin Account</p>
                <p className="mt-1 text-zinc-400">
                  Click <strong>"Add user"</strong> → <strong>"Create user"</strong>. Enter your admin email and a strong password, then toggle <strong>"Auto Confirm User"</strong> ON.
                </p>
                <p className="mt-2 font-semibold text-emerald-400">Step 3: Log In</p>
                <p className="mt-1 text-zinc-400">
                  Return to <code>/admin</code> and sign in with your credentials.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * TAB 1: OVERVIEW COMPONENT
 * ============================================================================
 */
function AdminOverviewTab({
  authToken,
  onNavigate,
  onSignOut,
}: {
  authToken: string;
  onNavigate: (tab: any) => void;
  onSignOut: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setRefreshing(true);
      setAuthError(null);
      const res = await (getAdminOverviewMetrics as any)({
        data: { authToken },
      });

      if (res && res.ok) {
        setData(res.data);
      } else {
        setAuthError(res?.error || "Access denied. Unable to load metrics.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to load overview data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [authToken]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-red-950/70 bg-[#070304] p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <h3 className="mt-3 text-lg font-bold text-red-300">Access Denied</h3>
        <p className="mt-1 text-xs text-zinc-400 max-w-md">{authError}</p>
        <button
          onClick={onSignOut}
          className="mt-5 rounded-lg border border-red-900/40 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-950"
        >
          Sign Out and Try Another Account
        </button>
      </div>
    );
  }

  const totalRegs = data?.totalRegistrations || 0;
  const vidsDone = data?.videosCompleted || 0;
  const liveSelected = data?.liveOptionSelected || 0;
  const recordedSelected = data?.recordedOptionSelected || 0;
  const attempts = data?.totalOrderAttempts || 0;
  const paidCount = data?.verifiedPaymentsCount || 0;
  const revenue = data?.totalVerifiedRevenue || 0;

  const vidCompletionRate = totalRegs > 0 ? ((vidsDone / totalRegs) * 100).toFixed(1) : "0";
  const orderSuccessRate = attempts > 0 ? ((paidCount / attempts) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Live Performance Metrics</h2>
          <p className="text-xs text-zinc-400">Protected real-time queries from Supabase backend</p>
        </div>
        <button
          onClick={fetchOverview}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-900/60 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Registrations */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Total Registrations</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{totalRegs}</div>
            <p className="mt-1 text-[11px] text-zinc-500">Leads captured from landing page</p>
          </div>
        </div>

        {/* Video Completed */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Videos Completed (95%+)</span>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20">
              <PlayCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{vidsDone}</div>
            <p className="mt-1 text-[11px] text-zinc-500">{vidCompletionRate}% of total registrations</p>
          </div>
        </div>

        {/* Verified Payments */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Verified Paid Students</span>
            <div className="rounded-lg bg-green-500/10 p-2 text-green-400 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-green-400">{paidCount}</div>
            <p className="mt-1 text-[11px] text-zinc-500">{orderSuccessRate}% of {attempts} checkout attempts</p>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Total Verified Revenue</span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-300">₹{revenue.toLocaleString("en-IN")}</div>
            <p className="mt-1 text-[11px] text-zinc-500">Live Razorpay settlements</p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics: Option breakdown & Checkout stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Option Selection Breakdown */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-5">
          <h3 className="text-sm font-semibold text-white">Course Track Breakdown</h3>
          <p className="text-xs text-zinc-400">Selected learning path distribution</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-200">Option A (Live Batch)</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">{liveSelected}</span>
              </div>
            </div>

            <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium text-zinc-200">Option B (Recorded)</span>
                </div>
                <span className="text-xs font-bold text-cyan-400">{recordedSelected}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Funnel Health Card */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white">Conversion Funnel Health</h3>
          <p className="text-xs text-zinc-400">Step-by-step funnel dropoff analysis</p>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-zinc-900 bg-black/40 p-3">
              <div className="text-xs text-zinc-500">Step 1: Registered</div>
              <div className="mt-1 text-lg font-bold text-zinc-200">{totalRegs}</div>
              <div className="text-[10px] text-emerald-400 font-semibold">100% Entry</div>
            </div>

            <div className="rounded-lg border border-zinc-900 bg-black/40 p-3">
              <div className="text-xs text-zinc-500">Step 2: Video Done</div>
              <div className="mt-1 text-lg font-bold text-zinc-200">{vidsDone}</div>
              <div className="text-[10px] text-cyan-400 font-semibold">{vidCompletionRate}%</div>
            </div>

            <div className="rounded-lg border border-zinc-900 bg-black/40 p-3">
              <div className="text-xs text-zinc-500">Step 3: Paid</div>
              <div className="mt-1 text-lg font-bold text-green-400">{paidCount}</div>
              <div className="text-[10px] text-green-400 font-semibold">
                {totalRegs > 0 ? ((paidCount / totalRegs) * 100).toFixed(1) : 0}% End-to-End
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Glance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Registrations */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Latest Registrations</h3>
            <button
              onClick={() => onNavigate("registrations")}
              className="text-xs text-emerald-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="mt-3 divide-y divide-emerald-950/40">
            {data?.recentRegistrations?.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">No registrations recorded yet.</p>
            ) : (
              data?.recentRegistrations?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-zinc-200">
                      {r.phone_country_code || "+91"} {r.phone_number}
                    </span>
                    <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {r.device_availability || "Device N/A"}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Latest Orders</h3>
            <button
              onClick={() => onNavigate("orders")}
              className="text-xs text-emerald-400 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="mt-3 divide-y divide-emerald-950/40">
            {data?.recentOrders?.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">No orders created yet.</p>
            ) : (
              data?.recentOrders?.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-semibold uppercase text-zinc-200">{o.selected_option} Track</span>
                    <span className="ml-2 text-zinc-400">₹{o.amount}</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      o.payment_status === "captured"
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {o.payment_status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * TAB 2: REGISTRATIONS MANAGEMENT COMPONENT
 * ============================================================================
 */
function AdminRegistrationsTab({
  authToken,
  onSignOut,
}: {
  authToken: string;
  onSignOut: () => void;
}) {
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState<"all" | "laptop" | "desktop" | "mobile">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const res = await (getAdminRegistrations as any)({
        data: {
          authToken,
          search,
          device,
          completedOnly: "all",
          selectedOption: "all",
          page,
          pageSize,
        },
      });

      if (res && res.ok) {
        setData(res);
      } else {
        setAuthError(res?.error || "Unable to fetch registrations.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to load registrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [authToken, search, device, page, pageSize]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await (exportRegistrationsCsvData as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  if (authError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-red-950/70 bg-[#070304] p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <h3 className="mt-3 text-lg font-bold text-red-300">Access Denied</h3>
        <p className="mt-1 text-xs text-zinc-400 max-w-md">{authError}</p>
        <button
          onClick={onSignOut}
          className="mt-5 rounded-lg border border-red-900/40 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-950"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search phone number or ID..."
              className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Device Filter */}
          <select
            value={device}
            onChange={(e: any) => {
              setDevice(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-emerald-950/80 bg-black/60 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Devices</option>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRegistrations}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-900/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black shadow-sm shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Registrations Table */}
      <div className="overflow-x-auto rounded-xl border border-emerald-950/70 bg-[#040d08]/80">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-emerald-950/80 bg-black/40 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Contact / Phone</th>
              <th className="px-4 py-3 font-semibold">Device</th>
              <th className="px-4 py-3 font-semibold">Video Status</th>
              <th className="px-4 py-3 font-semibold">Track</th>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 font-semibold">Registered</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-950/40 text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-emerald-500" />
                  <p className="mt-2">Loading registrations securely...</p>
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <Users className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-sm font-medium text-zinc-400">No matching registrations found</p>
                  <p className="text-xs text-zinc-600">Try adjusting your search query or device filter.</p>
                </td>
              </tr>
            ) : (
              data.items.map((row: any) => (
                <tr key={row.id} className="transition-colors hover:bg-emerald-950/20">
                  {/* Phone */}
                  <td className="px-4 py-3 font-mono font-medium text-zinc-100">
                    <div>{row.fullPhone}</div>
                    <div className="text-[10px] text-zinc-500 truncate max-w-[120px]" title={row.id}>
                      ID: {row.id.slice(0, 8)}...
                    </div>
                  </td>

                  {/* Device */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
                      {row.deviceAvailability.toLowerCase().includes("laptop") ? (
                        <Laptop className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Smartphone className="h-3 w-3 text-zinc-400" />
                      )}
                      <span className="capitalize">{row.deviceAvailability}</span>
                    </span>
                  </td>

                  {/* Video status */}
                  <td className="px-4 py-3">
                    {row.videoCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                        <Check className="h-3 w-3" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {Math.floor(row.videoProgressSeconds / 60)}m watched
                      </span>
                    )}
                  </td>

                  {/* Selected Option */}
                  <td className="px-4 py-3">
                    {row.selectedOption !== "—" ? (
                      <span className="font-semibold uppercase text-emerald-300">{row.selectedOption}</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Payment Status */}
                  <td className="px-4 py-3">
                    {row.paymentStatus === "captured" ? (
                      <span className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-green-300 border border-green-500/30">
                        Paid (₹{row.amount})
                      </span>
                    ) : row.paymentStatus === "pending" ? (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300 border border-amber-500/30">
                        Checkout Started
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>

                  {/* Registered Date */}
                  <td className="px-4 py-3 text-zinc-400">
                    <div>{new Date(row.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedRegId(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-900/60"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-emerald-950/80 bg-black/40 px-4 py-3 text-xs text-zinc-400">
          <div>
            Showing {data.items.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, data.total)} of {data.total} entries
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center rounded border border-emerald-950/80 p-1 text-zinc-300 hover:bg-emerald-950/40 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-zinc-200">
              Page {page} of {data.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages || loading}
              className="flex items-center rounded border border-emerald-950/80 p-1 text-zinc-300 hover:bg-emerald-950/40 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Registration Details Drawer */}
      {selectedRegId && (
        <RegistrationDetailDrawer authToken={authToken} registrationId={selectedRegId} onClose={() => setSelectedRegId(null)} />
      )}
    </div>
  );
}

/**
 * ============================================================================
 * REGISTRATION DETAIL DRAWER COMPONENT
 * ============================================================================
 */
function RegistrationDetailDrawer({
  authToken,
  registrationId,
  onClose,
}: {
  authToken: string;
  registrationId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await (getAdminRegistrationDetail as any)({
          data: { authToken, id: registrationId },
        });
        if (res && res.ok) {
          setDetail(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [authToken, registrationId]);

  const copyId = () => {
    navigator.clipboard.writeText(registrationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-emerald-950/80 bg-[#030a06] text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-emerald-950/80 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-white">Learner Profile</h3>
            <p className="text-xs text-zinc-400">Complete journey & transaction log</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-emerald-950/50 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-zinc-400">No details found for this registration.</p>
          ) : (
            <>
              {/* ID & Phone Card */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Registration ID</span>
                  <button
                    onClick={copyId}
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copied" : "Copy ID"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-zinc-300 break-all">{detail.id}</div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-950/60">
                  <div>
                    <span className="text-[11px] text-zinc-500">Mobile Phone</span>
                    <p className="text-sm font-semibold text-white">
                      {detail.phone_country_code || "+91"} {detail.phone_number}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-500">Device</span>
                    <p className="text-sm font-semibold text-white capitalize">
                      {detail.device_availability || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Video Progress Info */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Video Training Progress
                </h4>
                {detail.video_progress?.length > 0 ? (
                  detail.video_progress.map((vp: any) => (
                    <div key={vp.id} className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Completion Status:</span>
                        {vp.completion_status ? (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300 border border-emerald-500/30">
                            COMPLETED (95%+)
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-900 px-2 py-0.5 text-zinc-400">
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Playback Position:</span>
                        <span className="font-mono text-zinc-200">
                          {Math.floor(vp.last_position_seconds / 60)}m {Math.floor(vp.last_position_seconds % 60)}s
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Last Synced:</span>
                        <span className="text-zinc-400">{new Date(vp.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500">No video progress recorded yet.</p>
                )}
              </div>

              {/* Orders & Payments */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Orders & Razorpay Transactions
                </h4>
                {detail.orders?.length > 0 ? (
                  detail.orders.map((ord: any) => (
                    <div key={ord.id} className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase text-white">{ord.selected_option} Track</span>
                        <span className="font-bold text-emerald-400">₹{ord.amount}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>Payment Status:</span>
                        <span
                          className={`rounded px-1.5 py-0.2 font-semibold uppercase ${
                            ord.payment_status === "captured"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {ord.payment_status}
                        </span>
                      </div>
                      {ord.razorpay_payment_id && (
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Razorpay Txn:</span>
                          <span className="font-mono text-zinc-300">{ord.razorpay_payment_id}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500">
                        Created: {new Date(ord.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500">No orders initiated by this visitor yet.</p>
                )}
              </div>

              {/* Event Activity Log */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Funnel Activity Trail
                </h4>
                {detail.funnel_events?.length > 0 ? (
                  <div className="space-y-2 border-l border-emerald-950/80 pl-3">
                    {detail.funnel_events.map((ev: any) => (
                      <div key={ev.id} className="relative text-xs">
                        <div className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-zinc-200 uppercase">{ev.event_name.replace(/_/g, " ")}</span>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No additional event logs recorded.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * TAB 3: ORDERS & REVENUE COMPONENT
 * ============================================================================
 */
function AdminOrdersTab({
  authToken,
  onSignOut,
}: {
  authToken: string;
  onSignOut: () => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "captured" | "pending" | "failed">("all");
  const [selectedOption, setSelectedOption] = useState<"all" | "live" | "recorded">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      const res = await (getAdminOrders as any)({
        data: {
          authToken,
          search,
          status,
          selectedOption,
          page,
          pageSize,
        },
      });

      if (res && res.ok) {
        setData(res);
      } else {
        setAuthError(res?.error || "Unable to fetch orders.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [authToken, search, status, selectedOption, page, pageSize]);

  const handleExportOrders = async () => {
    try {
      setExporting(true);
      const res = await (exportOrdersCsvData as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  if (authError) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-red-950/70 bg-[#070304] p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-red-400" />
        <h3 className="mt-3 text-lg font-bold text-red-300">Access Denied</h3>
        <p className="mt-1 text-xs text-zinc-400 max-w-md">{authError}</p>
        <button
          onClick={onSignOut}
          className="mt-5 rounded-lg border border-red-900/40 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-950"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search Payment ID or Order ID..."
              className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <select
            value={status}
            onChange={(e: any) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-emerald-950/80 bg-black/60 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="captured">Captured (Paid)</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          {/* Track filter */}
          <select
            value={selectedOption}
            onChange={(e: any) => {
              setSelectedOption(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-emerald-950/80 bg-black/60 px-3 py-2 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">All Tracks</option>
            <option value="live">Live Masterclass</option>
            <option value="recorded">Recorded Track</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-900/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportOrders}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black shadow-sm shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? "Exporting..." : "Export Orders CSV"}</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-xl border border-emerald-950/70 bg-[#040d08]/80">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-emerald-950/80 bg-black/40 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer / Reg ID</th>
              <th className="px-4 py-3 font-semibold">Track</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Razorpay Order ID</th>
              <th className="px-4 py-3 font-semibold">Payment ID</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-950/40 text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-emerald-500" />
                  <p className="mt-2">Loading orders securely...</p>
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500">
                  <CreditCard className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-sm font-medium text-zinc-400">No matching orders found</p>
                  <p className="text-xs text-zinc-600">Orders will appear here as visitors start checkout.</p>
                </td>
              </tr>
            ) : (
              data.items.map((row: any) => (
                <tr key={row.id} className="transition-colors hover:bg-emerald-950/20">
                  {/* Customer */}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-100">{row.customerPhone}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {row.registrationId ? `Reg: ${row.registrationId.slice(0, 8)}...` : "—"}
                    </div>
                  </td>

                  {/* Track */}
                  <td className="px-4 py-3 font-semibold uppercase text-emerald-300">
                    {row.selectedOption}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 font-bold text-white">
                    ₹{row.amount} {row.currency}
                  </td>

                  {/* Razorpay Order ID */}
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                    {row.razorpayOrderId}
                  </td>

                  {/* Razorpay Payment ID */}
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-300">
                    {row.razorpayPaymentId}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        row.paymentStatus === "captured"
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : row.paymentStatus === "pending"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {row.paymentStatus === "captured" ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {row.paymentStatus}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-zinc-400">
                    <div>{new Date(row.createdAt).toLocaleDateString()}</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-emerald-950/80 bg-black/40 px-4 py-3 text-xs text-zinc-400">
          <div>
            Showing {data.items.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, data.total)} of {data.total} orders
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center rounded border border-emerald-950/80 p-1 text-zinc-300 hover:bg-emerald-950/40 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-zinc-200">
              Page {page} of {data.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages || loading}
              className="flex items-center rounded border border-emerald-950/80 p-1 text-zinc-300 hover:bg-emerald-950/40 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * TAB 4: SETTINGS & ACCOUNT COMPONENT
 * ============================================================================
 */
function AdminSettingsTab({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => void }) {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Account Info */}
      <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-6">
        <h3 className="text-base font-bold text-white">Active Administrator Account</h3>
        <p className="mt-1 text-xs text-zinc-400">Current active Supabase authenticated session</p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-black/40 p-3 text-xs">
            <span className="text-zinc-400">Authenticated Email:</span>
            <span className="font-semibold text-emerald-400">{userEmail}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-black/40 p-3 text-xs">
            <span className="text-zinc-400">Authorization Mechanism:</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border border-emerald-500/30">
              Supabase Auth JWT Token + Server-Side Verification
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950/60"
          >
            <LogOut className="h-4 w-4" />
            Sign Out of Admin Dashboard
          </button>
        </div>
      </div>

      {/* Team Management */}
      <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-6">
        <h3 className="text-base font-bold text-white">Managing Administrator Accounts</h3>
        <p className="mt-1 text-xs text-zinc-400">
          How to securely add or revoke administrator accounts in Supabase
        </p>

        <div className="mt-4 space-y-3 text-xs text-zinc-300">
          <div className="rounded-lg border border-emerald-900/30 bg-black/40 p-3.5 leading-relaxed">
            <p className="font-semibold text-emerald-400">1. Adding an Administrator</p>
            <p className="text-zinc-400">
              In Supabase Console (<code>xlyqrzcstkxdkyvdensc</code>) &gt; <strong>Authentication</strong> &gt; <strong>Users</strong> &gt; <strong>Add User</strong>. Auto-confirm the user and assign a strong password.
            </p>
          </div>

          <div className="rounded-lg border border-emerald-900/30 bg-black/40 p-3.5 leading-relaxed">
            <p className="font-semibold text-emerald-400">2. Revoking Access</p>
            <p className="text-zinc-400">
              To revoke access, simply delete or ban the user in Supabase Authentication. Their JWT will be invalidated immediately on the next request.
            </p>
          </div>
        </div>
      </div>

      {/* Security Policies Audit */}
      <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-6">
        <h3 className="text-base font-bold text-white">Security Architecture</h3>
        <div className="mt-3 space-y-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Row Level Security (RLS) is ENABLED across all 4 database tables.</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Direct public client SELECT queries on customer data are blocked.</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>All dashboard data queries strictly verify Supabase Auth JWT tokens on the server.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
