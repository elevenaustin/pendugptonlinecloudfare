import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminOverviewMetrics,
  getAdminRegistrations,
  getAdminOrders,
  getAdminRegistrationDetail,
  updateAdminLeadStatus,
  batchUpdateAdminLeads,
  syncRazorpayPayments,
  exportRegistrationsCsvData,
  exportOrdersCsvData,
  syncRegistrationsToSupabaseLeads,
  exportContactsOnlyCsvData,
  exportPhoneNumbersTxtData,
} from "@/lib/admin.functions";
import {
  UploadCloud,
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
  Lock,
  Mail,
  Key,
  Menu,
  KeyRound,
  ShieldAlert,
  MessageSquare,
  Phone,
  SlidersHorizontal,
  CheckSquare,
  Square,
  UserCheck,
  FileText,
  Send,
  ChevronDown,
} from "lucide-react";

const ADMIN_PASSCODES = ["PenduGPT2026", "PenduGPT26430", "pendugpt2026", "pendugpt26430"];
const ADMIN_PASSCODE = "PenduGPT2026";
const PASSCODE_STORAGE_KEY = "pendugpt_admin_passcode_auth";

export function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "orders" | "settings">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check auth session (supports Passcode "PenduGPT2026" & Supabase Auth)
  useEffect(() => {
    // 1. Check URL query param ?key=...
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlKey = urlParams.get("key");
      if (urlKey && (ADMIN_PASSCODES.includes(urlKey.trim()))) {
        localStorage.setItem(PASSCODE_STORAGE_KEY, ADMIN_PASSCODE);
        setSession({
          access_token: ADMIN_PASSCODE,
          user: { email: "master-admin@pendugpt.com" },
        });
        setLoadingAuth(false);
        return;
      }
    } catch {
      /* ignore */
    }

    // 2. Check localStorage saved passcode
    try {
      const savedPasscode = localStorage.getItem(PASSCODE_STORAGE_KEY);
      if (savedPasscode && (ADMIN_PASSCODES.includes(savedPasscode))) {
        setSession({
          access_token: ADMIN_PASSCODE,
          user: { email: "master-admin@pendugpt.com" },
        });
        setLoadingAuth(false);
        return;
      }
    } catch {
      /* ignore */
    }

    // 3. Check Supabase Auth Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
      }
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
      }
      setLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      localStorage.removeItem(PASSCODE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    setSession(null);
  };

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020604] text-emerald-400">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm tracking-wide text-zinc-400">Verifying administrator access...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.access_token) {
    return <AdminLoginForm onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const authToken = session.access_token;
  const userEmail = session.user?.email || "master-admin@pendugpt.com";

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
              <p className="text-[11px] text-zinc-400">Control & CRM Hub</p>
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
            Leads & Funnel
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
            <p className="mt-0.5 text-[10px] text-zinc-500">Live Database Synced</p>
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
              {activeTab === "registrations" && "Leads & Funnel Registrations"}
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
 * LOGIN SCREEN COMPONENT (Clean passcode input with NO hint texts)
 * ============================================================================
 */
function AdminLoginForm({ onLoginSuccess }: { onLoginSuccess: (session: any) => void }) {
  const [authMode, setAuthMode] = useState<"passcode" | "email">("passcode");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Handle Passcode Login
  const handlePasscodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const inputClean = passcodeInput.trim();
    if (
      inputClean === ADMIN_PASSCODE ||
      inputClean === "PEnduGPT2026" ||
      inputClean.toLowerCase() === "pendugpt2026"
    ) {
      try {
        localStorage.setItem(PASSCODE_STORAGE_KEY, ADMIN_PASSCODE);
      } catch {
        /* ignore */
      }
      onLoginSuccess({
        access_token: ADMIN_PASSCODE,
        user: { email: "master-admin@pendugpt.com" },
      });
    } else {
      setErrorMsg("Incorrect passcode. Please verify and try again.");
    }
  };

  // Handle Supabase Email & Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
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
      setErrorMsg(err.message || "Invalid administrator credentials.");
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
            Private management portal. Authorized access only.
          </p>
        </div>

        {/* Login Box */}
        <div className="rounded-xl border border-emerald-950/80 bg-[#040d08]/90 p-6 shadow-2xl backdrop-blur-md">
          {/* Auth Method Tabs */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-emerald-950/80 bg-black/60 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("passcode");
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                authMode === "passcode"
                  ? "bg-emerald-500 text-black shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Admin Key</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("email");
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                authMode === "email"
                  ? "bg-emerald-500 text-black shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Email & Password</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 p-3 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode 1: Passcode Key Auth (Clean input, NO hints) */}
          {authMode === "passcode" ? (
            <form onSubmit={handlePasscodeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300">Admin Key</label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder=""
                    className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                <Lock className="h-4 w-4" />
                <span>Access Dashboard</span>
              </button>
            </form>
          ) : (
            /* Mode 2: Supabase Email & Password Auth */
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300">Admin Email</label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
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
                    placeholder=""
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
                    <span>Access Dashboard</span>
                  </>
                )}
              </button>
            </form>
          )}
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
  const [syncingRzp, setSyncingRzp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchOverview = async (triggerSync = false) => {
    try {
      setRefreshing(true);
      setAuthError(null);

      if (triggerSync) {
        setSyncingRzp(true);
        try {
          await (syncRazorpayPayments as any)({ data: { authToken } });
        } catch {
          /* ignore */
        } finally {
          setSyncingRzp(false);
        }
      }

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
    fetchOverview(false);
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
          Sign Out and Try Again
        </button>
      </div>
    );
  }

  const totalRegs = data?.totalRegistrations || 0;
  const unreadCount = data?.unreadCount || 0;
  const followedUpCount = data?.followedUpCount || 0;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Live Performance & CRM Metrics</h2>
          <p className="text-xs text-zinc-400">Protected real-time data synced with Razorpay & Database</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOverview(true)}
            disabled={syncingRzp || refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
            title="Reconcile and sync payments directly from Razorpay"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingRzp ? "animate-spin" : ""}`} />
            <span>{syncingRzp ? "Syncing Razorpay..." : "Sync Live Payments"}</span>
          </button>

          <button
            onClick={() => fetchOverview(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-900/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Registrations & Unread */}
        <div
          onClick={() => onNavigate("registrations")}
          className="cursor-pointer rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm transition hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Total Captured Leads</span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{totalRegs}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {unreadCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.2 font-semibold text-blue-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {unreadCount} Unread
                </span>
              ) : (
                <span className="text-zinc-500">All leads read</span>
              )}
              <span className="text-zinc-500">• {followedUpCount} followed up</span>
            </div>
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
        <div
          onClick={() => onNavigate("orders")}
          className="cursor-pointer rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-4 backdrop-blur-sm transition hover:border-green-500/40"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Verified Paid Students</span>
            <div className="rounded-lg bg-green-500/10 p-2 text-green-400 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-green-400">{paidCount}</div>
            <p className="mt-1 text-[11px] text-zinc-500">{orderSuccessRate}% conversion rate</p>
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

      {/* Secondary Metrics */}
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
                  <span className="text-xs font-medium text-zinc-200">Option A (Live Batch ₹5,999)</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">{liveSelected}</span>
              </div>
            </div>

            <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-medium text-zinc-200">Option B (Recorded ₹2,499)</span>
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
            <h3 className="text-sm font-semibold text-white">Latest Leads</h3>
            <button
              onClick={() => onNavigate("registrations")}
              className="text-xs text-emerald-400 hover:underline"
            >
              Manage All Leads
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
              View All Orders
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
 * LEAD STATUS BADGE CONFIG
 * ============================================================================
 */
const LEAD_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  new: {
    label: "New Lead",
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    border: "border-blue-500/30",
    icon: Sparkles,
  },
  followed_up: {
    label: "Followed Up",
    bg: "bg-purple-500/15",
    text: "text-purple-300",
    border: "border-purple-500/30",
    icon: Phone,
  },
  in_discussion: {
    label: "In Discussion",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/30",
    icon: MessageSquare,
  },
  callback: {
    label: "Callback",
    bg: "bg-cyan-500/15",
    text: "text-cyan-300",
    border: "border-cyan-500/30",
    icon: Clock,
  },
  converted: {
    label: "Converted",
    bg: "bg-green-500/15",
    text: "text-green-300",
    border: "border-green-500/30",
    icon: CheckCircle2,
  },
  not_interested: {
    label: "Not Interested",
    bg: "bg-zinc-800",
    text: "text-zinc-400",
    border: "border-zinc-700",
    icon: X,
  },
};

/**
 * ============================================================================
 * TAB 2: ADVANCED LEADS & REGISTRATIONS CRM COMPONENT
 * ============================================================================
 */
function AdminRegistrationsTab({
  authToken,
  onSignOut,
}: {
  authToken: string;
  onSignOut: () => void;
}) {
  // Filter States
  const [search, setSearch] = useState("");
  const [quickTab, setQuickTab] = useState<"all" | "unread" | "followed_up" | "in_discussion" | "converted" | "paid">("all");
  const [readStatus, setReadStatus] = useState<"all" | "read" | "unread">("all");
  const [leadStatus, setLeadStatus] = useState<
    "all" | "new" | "followed_up" | "in_discussion" | "callback" | "converted" | "not_interested"
  >("all");
  const [funnelStage, setFunnelStage] = useState<
    "all" | "registered" | "video_progress" | "video_completed" | "checkout_started" | "paid"
  >("all");
  const [selectedOption, setSelectedOption] = useState<"all" | "live" | "recorded" | "none">("all");
  const [device, setDevice] = useState<"all" | "laptop" | "mobile">("all");
  const [gender, setGender] = useState<"all" | "male" | "female" | "unspecified">("all");
  const [countryCode, setCountryCode] = useState<"all" | "india" | "international">("all");
  const [datePeriod, setDatePeriod] = useState<"all" | "today" | "yesterday" | "last_7_days" | "last_30_days">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "video_progress" | "last_contacted_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI & Table States
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);

  // Pagination & Data States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [data, setData] = useState<any>({
    items: [],
    total: 0,
    totalPages: 1,
    globalCounts: { total: 0, unread: 0, followedUp: 0, inDiscussion: 0, converted: 0, paid: 0, newToday: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseSyncMsg, setSupabaseSyncMsg] = useState<string | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [copyFeedbackToast, setCopyFeedbackToast] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch leads with active filters
  const fetchRegistrations = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setAuthError(null);

      let effectiveReadStatus = readStatus;
      let effectiveLeadStatus = leadStatus;
      let effectiveFunnelStage = funnelStage;

      if (quickTab === "unread") effectiveReadStatus = "unread";
      if (quickTab === "followed_up") effectiveLeadStatus = "followed_up";
      if (quickTab === "in_discussion") effectiveLeadStatus = "in_discussion";
      if (quickTab === "converted") effectiveLeadStatus = "converted";
      if (quickTab === "paid") effectiveFunnelStage = "paid";

      const res = await (getAdminRegistrations as any)({
        data: {
          authToken,
          search,
          readStatus: effectiveReadStatus,
          leadStatus: effectiveLeadStatus,
          funnelStage: effectiveFunnelStage,
          selectedOption,
          device,
          gender,
          countryCode,
          datePeriod,
          sortBy,
          sortOrder,
          page,
          pageSize,
        },
      });

      if (res && res.ok) {
        setData(res);
      } else {
        setAuthError(res?.error || "Unable to fetch leads.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to load leads.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [
    authToken,
    search,
    quickTab,
    readStatus,
    leadStatus,
    funnelStage,
    selectedOption,
    device,
    gender,
    countryCode,
    datePeriod,
    sortBy,
    sortOrder,
    page,
    pageSize,
  ]);

  // Real-time Auto-Refresh interval (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchRegistrations(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle Quick Read/Unread Toggle
  const handleToggleRead = async (row: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newReadState = !row.isRead;

    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any) =>
        item.id === row.id ? { ...item, isRead: newReadState } : item,
      ),
      globalCounts: {
        ...prev.globalCounts,
        unread: newReadState ? Math.max(0, prev.globalCounts.unread - 1) : prev.globalCounts.unread + 1,
      },
    }));

    try {
      await (updateAdminLeadStatus as any)({
        data: {
          authToken,
          registrationId: row.id,
          isRead: newReadState,
        },
      });
    } catch (err) {
      console.error("Failed to update read state:", err);
      fetchRegistrations(true);
    }
  };

  // Handle Lead Status Change
  const handleStatusChange = async (registrationId: string, newStatus: string) => {
    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((item: any) =>
        item.id === registrationId ? { ...item, leadStatus: newStatus, isRead: true } : item,
      ),
    }));

    try {
      await (updateAdminLeadStatus as any)({
        data: {
          authToken,
          registrationId,
          leadStatus: newStatus,
          isRead: true,
        },
      });
    } catch (err) {
      console.error("Failed to update lead status:", err);
      fetchRegistrations(true);
    }
  };

  // Handle Bulk Status Update
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedLeadIds.length === 0) return;
    try {
      setLoading(true);
      await (batchUpdateAdminLeads as any)({
        data: {
          authToken,
          registrationIds: selectedLeadIds,
          leadStatus: newStatus,
          isRead: true,
        },
      });
      setSelectedLeadIds([]);
      await fetchRegistrations();
    } catch (err) {
      console.error("Bulk update failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Bulk Read/Unread
  const handleBulkReadState = async (newReadState: boolean) => {
    if (selectedLeadIds.length === 0) return;
    try {
      setLoading(true);
      await (batchUpdateAdminLeads as any)({
        data: {
          authToken,
          registrationIds: selectedLeadIds,
          isRead: newReadState,
        },
      });
      setSelectedLeadIds([]);
      await fetchRegistrations();
    } catch (err) {
      console.error("Bulk read update failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.length === data.items.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(data.items.map((i: any) => i.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // ⚡ Sync All Registrations to Supabase Leads Table
  const handleSyncToSupabase = async () => {
    try {
      setIsSyncingSupabase(true);
      setSupabaseSyncMsg(null);
      const res = await (syncRegistrationsToSupabaseLeads as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        setSupabaseSyncMsg(`✅ ${res.message || "Synced leads to Supabase successfully!"}`);
      } else {
        setSupabaseSyncMsg(`❌ Failed to sync: ${res?.error || "Unknown error"}`);
      }
    } catch (err: any) {
      setSupabaseSyncMsg(`❌ Sync error: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSyncingSupabase(false);
      setTimeout(() => setSupabaseSyncMsg(null), 8000);
    }
  };

  // Export Full CSV
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      setExportDropdownOpen(false);
      const res = await (exportRegistrationsCsvData as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        downloadBlobFile(res.csvContent, "text/csv;charset=utf-8;", res.filename);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Export Contacts Only CSV
  const handleExportContactsOnly = async () => {
    try {
      setExporting(true);
      setExportDropdownOpen(false);
      const res = await (exportContactsOnlyCsvData as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        downloadBlobFile(res.csvContent, "text/csv;charset=utf-8;", res.filename);
      }
    } catch (err) {
      console.error("Export contacts error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Export Phone Numbers TXT
  const handleExportPhoneTxt = async () => {
    try {
      setExporting(true);
      setExportDropdownOpen(false);
      const res = await (exportPhoneNumbersTxtData as any)({
        data: { authToken },
      });
      if (res && res.ok) {
        downloadBlobFile(res.txtContent, "text/plain;charset=utf-8;", res.filename);
      }
    } catch (err) {
      console.error("Export txt error:", err);
    } finally {
      setExporting(false);
    }
  };

  // Copy Phone Numbers to Clipboard
  const handleCopyPhoneNumbers = (itemsToCopy: any[], label: string) => {
    const phones = Array.from(
      new Set(
        itemsToCopy
          .map((i: any) => (i.phone_number || "").replace(/\D/g, ""))
          .filter((p: string) => p.length >= 10)
      )
    );
    if (phones.length === 0) {
      alert("No phone numbers to copy.");
      return;
    }
    navigator.clipboard.writeText(phones.join("\n"));
    setCopyFeedbackToast(`📋 Copied ${phones.length} phone numbers (${label}) to clipboard!`);
    setTimeout(() => setCopyFeedbackToast(null), 4000);
    setExportDropdownOpen(false);
  };

  function downloadBlobFile(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleResetFilters = () => {
    setSearch("");
    setQuickTab("all");
    setReadStatus("all");
    setLeadStatus("all");
    setFunnelStage("all");
    setSelectedOption("all");
    setDevice("all");
    setGender("all");
    setCountryCode("all");
    setDatePeriod("all");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const activeFilterCount =
    (readStatus !== "all" ? 1 : 0) +
    (leadStatus !== "all" ? 1 : 0) +
    (funnelStage !== "all" ? 1 : 0) +
    (selectedOption !== "all" ? 1 : 0) +
    (device !== "all" ? 1 : 0) +
    (gender !== "all" ? 1 : 0) +
    (countryCode !== "all" ? 1 : 0) +
    (datePeriod !== "all" ? 1 : 0) +
    (search ? 1 : 0);

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

  const counts = data.globalCounts || {};

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {copyFeedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-emerald-500/50 bg-black/90 px-4 py-3 text-xs font-bold text-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.4)] backdrop-blur-xl animate-in slide-in-from-bottom-5">
          {copyFeedbackToast}
        </div>
      )}

      {/* Supabase Sync Feedback Banner */}
      {supabaseSyncMsg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 p-4 text-center text-xs font-bold text-emerald-300 backdrop-blur animate-in fade-in">
          {supabaseSyncMsg}
        </div>
      )}
      {/* Top Quick Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => {
            setQuickTab("all");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "all"
              ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
              : "border border-emerald-950/80 bg-[#040d08]/80 text-zinc-400 hover:bg-emerald-950/40 hover:text-zinc-200"
          }`}
        >
          <span>All Leads</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "all" ? "bg-black/20 text-black font-bold" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {counts.total || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickTab("unread");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "unread"
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
              : "border border-blue-950/60 bg-[#030911]/80 text-blue-300 hover:bg-blue-950/40"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span>Unread Leads</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "unread" ? "bg-black/30 text-white font-bold" : "bg-blue-900/60 text-blue-200"
            }`}
          >
            {counts.unread || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickTab("followed_up");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "followed_up"
              ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
              : "border border-purple-950/60 bg-[#0a0512]/80 text-purple-300 hover:bg-purple-950/40"
          }`}
        >
          <Phone className="h-3 w-3" />
          <span>Followed Up</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "followed_up" ? "bg-black/30 text-white font-bold" : "bg-purple-900/60 text-purple-200"
            }`}
          >
            {counts.followedUp || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickTab("in_discussion");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "in_discussion"
              ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
              : "border border-amber-950/60 bg-[#0d0903]/80 text-amber-300 hover:bg-amber-950/40"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          <span>In Discussion</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "in_discussion" ? "bg-black/20 text-black font-bold" : "bg-amber-900/60 text-amber-200"
            }`}
          >
            {counts.inDiscussion || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickTab("converted");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "converted"
              ? "bg-green-500 text-black shadow-md shadow-green-500/20"
              : "border border-green-950/60 bg-[#030d06]/80 text-green-300 hover:bg-green-950/40"
          }`}
        >
          <UserCheck className="h-3 w-3" />
          <span>Converted</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "converted" ? "bg-black/20 text-black font-bold" : "bg-green-900/60 text-green-200"
            }`}
          >
            {counts.converted || 0}
          </span>
        </button>

        <button
          onClick={() => {
            setQuickTab("paid");
            setPage(1);
          }}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold transition ${
            quickTab === "paid"
              ? "bg-emerald-400 text-black shadow-md shadow-emerald-400/20"
              : "border border-emerald-950/60 bg-[#030d08]/80 text-emerald-300 hover:bg-emerald-950/40"
          }`}
        >
          <CreditCard className="h-3 w-3" />
          <span>Paid Orders</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              quickTab === "paid" ? "bg-black/20 text-black font-bold" : "bg-emerald-900/60 text-emerald-200"
            }`}
          >
            {counts.paid || 0}
          </span>
        </button>
      </div>

      {/* Main Filter & Action Bar */}
      <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/85 p-4 space-y-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder=""
              className="w-full rounded-lg border border-emerald-950/80 bg-black/60 py-2 pl-9 pr-8 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggle & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                showFilters || activeFilterCount > 0
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-emerald-950/80 bg-black/60 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-bold text-black">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                autoRefresh
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-emerald-950/80 bg-black/60 text-zinc-500 hover:text-zinc-400"
              }`}
              title="Real-time 30s auto-refresh"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
              <span>Live Sync</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchRegistrations()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-900/50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {/* ⚡ Sync to Supabase Button */}
            <button
              onClick={handleSyncToSupabase}
              disabled={isSyncingSupabase}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/60 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500/30 active:scale-95 transition-all disabled:opacity-50"
              title="Push all registrations and video watch progress to live Supabase leads table"
            >
              <UploadCloud className={`h-4 w-4 text-emerald-400 ${isSyncingSupabase ? "animate-bounce" : ""}`} />
              <span>{isSyncingSupabase ? "Syncing to Supabase..." : "⚡ Sync to Supabase"}</span>
            </button>

            {/* Export Dropdown Suite */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black shadow-sm shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{exporting ? "Exporting..." : "Export Leads"}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${exportDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-emerald-950/80 bg-[#040d08]/95 p-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 border-b border-emerald-950/60">
                    Export Options (Total: {counts.total || 0} leads)
                  </div>

                  <button
                    onClick={handleExportCsv}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-emerald-950/50 hover:text-white transition-colors"
                  >
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <div>Export Full Data (CSV)</div>
                      <div className="text-[10px] text-zinc-400 font-normal">All 18+ registration & order fields</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportContactsOnly}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-emerald-950/50 hover:text-white transition-colors"
                  >
                    <Phone className="h-4 w-4 text-sky-400 shrink-0" />
                    <div>
                      <div>Export Only Contacts (CSV)</div>
                      <div className="text-[10px] text-zinc-400 font-normal">Formatted for WhatsApp CRM / Broadcasts</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportPhoneTxt}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-emerald-950/50 hover:text-white transition-colors"
                  >
                    <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                    <div>
                      <div>Export Phone Numbers (TXT)</div>
                      <div className="text-[10px] text-zinc-400 font-normal">1 number per line for bulk messaging</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleCopyPhoneNumbers(data.items, "Current Page Leads")}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-emerald-950/50 hover:text-white transition-colors"
                  >
                    <Copy className="h-4 w-4 text-purple-400 shrink-0" />
                    <div>
                      <div>Copy Phone Numbers</div>
                      <div className="text-[10px] text-zinc-400 font-normal">Direct copy to clipboard</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showFilters && (
          <div className="pt-3 border-t border-emerald-950/70 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 text-xs animate-in fade-in duration-150">
            {/* Lead Status */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Lead Status</label>
              <select
                value={leadStatus}
                onChange={(e: any) => {
                  setLeadStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="new">New Lead</option>
                <option value="followed_up">Followed Up</option>
                <option value="in_discussion">In Discussion</option>
                <option value="callback">Callback Scheduled</option>
                <option value="converted">Converted</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>

            {/* Read / Unread */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Read State</label>
              <select
                value={readStatus}
                onChange={(e: any) => {
                  setReadStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All (Read & Unread)</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>

            {/* Funnel Stage */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Funnel Stage</label>
              <select
                value={funnelStage}
                onChange={(e: any) => {
                  setFunnelStage(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Stages</option>
                <option value="registered">Registered (0%)</option>
                <option value="video_progress">Video In Progress</option>
                <option value="video_completed">Video Completed</option>
                <option value="checkout_started">Checkout Initiated</option>
                <option value="paid">Payment Completed</option>
              </select>
            </div>

            {/* Course Track */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Course Track</label>
              <select
                value={selectedOption}
                onChange={(e: any) => {
                  setSelectedOption(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Tracks</option>
                <option value="live">Option A (Live ₹5,999)</option>
                <option value="recorded">Option B (Recorded ₹2,499)</option>
                <option value="none">No Track Chosen</option>
              </select>
            </div>

            {/* Device */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Device Type</label>
              <select
                value={device}
                onChange={(e: any) => {
                  setDevice(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Devices</option>
                <option value="laptop">Laptop / Desktop</option>
                <option value="mobile">Mobile Phone Only</option>
              </select>
            </div>

            {/* Date Period */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Date Registered</label>
              <select
                value={datePeriod}
                onChange={(e: any) => {
                  setDatePeriod(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
              </select>
            </div>

            {/* Country */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Region</label>
              <select
                value={countryCode}
                onChange={(e: any) => {
                  setCountryCode(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Countries</option>
                <option value="india">India (+91)</option>
                <option value="international">International</option>
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e: any) => {
                  setGender(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unspecified">Unspecified</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e: any) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-950/80 bg-black/60 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="created_at">Registered Date</option>
                <option value="video_progress">Video Watch %</option>
                <option value="last_contacted_at">Last Followed Up</option>
              </select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end lg:col-span-3">
              <button
                onClick={handleResetFilters}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar (Visible when leads are selected) */}
      {selectedLeadIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-[#04160d] p-3 text-xs text-white shadow-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-black">
              {selectedLeadIds.length}
            </span>
            <span className="font-semibold text-emerald-300">Leads Selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkReadState(true)}
              className="flex items-center gap-1 rounded-lg border border-emerald-900/40 bg-black/40 px-2.5 py-1.5 font-medium text-emerald-300 hover:bg-emerald-950"
            >
              <Check className="h-3 w-3" />
              <span>Mark Read</span>
            </button>

            <button
              onClick={() => handleBulkReadState(false)}
              className="flex items-center gap-1 rounded-lg border border-blue-900/40 bg-black/40 px-2.5 py-1.5 font-medium text-blue-300 hover:bg-blue-950"
            >
              <Clock className="h-3 w-3" />
              <span>Mark Unread</span>
            </button>

            <button
              onClick={() => handleBulkStatusChange("followed_up")}
              className="flex items-center gap-1 rounded-lg border border-purple-900/40 bg-black/40 px-2.5 py-1.5 font-medium text-purple-300 hover:bg-purple-950"
            >
              <Phone className="h-3 w-3" />
              <span>Mark Followed Up</span>
            </button>

            <button
              onClick={() => handleBulkStatusChange("in_discussion")}
              className="flex items-center gap-1 rounded-lg border border-amber-900/40 bg-black/40 px-2.5 py-1.5 font-medium text-amber-300 hover:bg-amber-950"
            >
              <MessageSquare className="h-3 w-3" />
              <span>In Discussion</span>
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="rounded-lg p-1 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Registrations / Leads Table */}
      <div className="overflow-x-auto rounded-xl border border-emerald-950/70 bg-[#040d08]/80">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-emerald-950/80 bg-black/40 text-zinc-400">
            <tr>
              <th className="w-8 px-3 py-3 text-center">
                <button
                  onClick={handleSelectAll}
                  className="text-zinc-400 hover:text-zinc-200"
                  title="Select all on this page"
                >
                  {selectedLeadIds.length > 0 && selectedLeadIds.length === data.items.length ? (
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="w-6 px-1 py-3 text-center font-semibold" title="Read / Unread State">
                •
              </th>
              <th className="px-3 py-3 font-semibold">Contact / Phone</th>
              <th className="px-3 py-3 font-semibold">Lead Status</th>
              <th className="px-3 py-3 font-semibold">Funnel Progress</th>
              <th className="px-3 py-3 font-semibold">Track & Payment</th>
              <th className="px-3 py-3 font-semibold">Device</th>
              <th className="px-3 py-3 font-semibold">Registered</th>
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-950/40 text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500">
                  <RefreshCw className="mx-auto h-5 w-5 animate-spin text-emerald-500" />
                  <p className="mt-2">Loading leads securely...</p>
                </td>
              </tr>
            ) : data.items.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-zinc-500">
                  <Users className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-sm font-medium text-zinc-400">No matching leads found</p>
                  <p className="text-xs text-zinc-600">Try adjusting your filters or search term.</p>
                </td>
              </tr>
            ) : (
              data.items.map((row: any) => {
                const statusConfig =
                  LEAD_STATUS_CONFIG[row.leadStatus] || LEAD_STATUS_CONFIG["new"];
                const isSelected = selectedLeadIds.includes(row.id);
                const cleanPhoneDigits = (row.phoneCountryCode + row.phoneNumber).replace(/\D/g, "");
                const waText = encodeURIComponent(
                  "Hello! This is from PenduGPT Masterclass. We saw you registered for our training. How can we help you get started?",
                );
                const waUrl = `https://wa.me/${cleanPhoneDigits}?text=${waText}`;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-emerald-950/25 ${
                      !row.isRead ? "bg-emerald-950/10 font-medium" : ""
                    } ${isSelected ? "bg-emerald-950/30" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggleSelectOne(row.id)}
                        className="text-zinc-400 hover:text-zinc-200"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {/* Unread / Read Indicator */}
                    <td className="px-1 py-3 text-center">
                      <button
                        onClick={(e) => handleToggleRead(row, e)}
                        className="group relative"
                        title={row.isRead ? "Mark as Unread" : "Mark as Read"}
                      >
                        {!row.isRead ? (
                          <span className="block h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 group-hover:scale-125 transition" />
                        ) : (
                          <span className="block h-2 w-2 rounded-full bg-zinc-700 opacity-40 group-hover:opacity-100 group-hover:bg-zinc-500 transition" />
                        )}
                      </button>
                    </td>

                    {/* Contact & Phone */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-100">{row.fullPhone}</span>
                        {/* Quick WhatsApp Link */}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black transition"
                          title="Chat on WhatsApp"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </a>
                        {/* Quick Call Link */}
                        <a
                          href={`tel:${row.fullPhone}`}
                          className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                          title="Call Number"
                        >
                          <Phone className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        ID: {row.id.slice(0, 8)}...
                      </div>
                      {row.adminNotes && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-300 truncate max-w-[200px]" title={row.adminNotes}>
                          <FileText className="h-3 w-3 shrink-0" />
                          <span>{row.adminNotes}</span>
                        </div>
                      )}
                    </td>

                    {/* Interactive Lead Status Dropdown */}
                    <td className="px-3 py-3">
                      <div className="relative inline-block">
                        <select
                          value={row.leadStatus}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                          className={`appearance-none rounded-lg border px-2.5 py-1 pr-6 text-[11px] font-bold uppercase transition focus:outline-none cursor-pointer ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                        >
                          <option value="new" className="bg-zinc-900 text-zinc-200">
                            🆕 New Lead
                          </option>
                          <option value="followed_up" className="bg-zinc-900 text-zinc-200">
                            📞 Followed Up
                          </option>
                          <option value="in_discussion" className="bg-zinc-900 text-zinc-200">
                            💬 In Discussion
                          </option>
                          <option value="callback" className="bg-zinc-900 text-zinc-200">
                            ⏰ Callback
                          </option>
                          <option value="converted" className="bg-zinc-900 text-zinc-200">
                            🎓 Converted
                          </option>
                          <option value="not_interested" className="bg-zinc-900 text-zinc-200">
                            🚫 Not Interested
                          </option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
                      </div>
                      {row.lastContactedAt && (
                        <div className="mt-0.5 text-[9px] text-zinc-500">
                          Followed up: {new Date(row.lastContactedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    {/* Funnel Progress */}
                    <td className="px-3 py-3">
                      {row.videoCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                          <Check className="h-3 w-3" />
                          Video Done (100%)
                        </span>
                      ) : row.videoProgressSeconds > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
                            <Clock className="h-3 w-3 text-zinc-400" />
                            {Math.floor(row.videoProgressSeconds / 60)}m watched
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Not started</span>
                      )}
                    </td>

                    {/* Track & Payment */}
                    <td className="px-3 py-3">
                      <div>
                        {row.selectedOption !== "—" ? (
                          <span className="font-semibold uppercase text-emerald-300">{row.selectedOption} Track</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </div>
                      <div className="mt-0.5">
                        {row.paymentStatus === "captured" ? (
                          <span className="rounded bg-green-500/20 px-1.5 py-0.2 text-[10px] font-bold uppercase text-green-300 border border-green-500/30">
                            Paid ₹{row.amount}
                          </span>
                        ) : row.paymentStatus === "pending" ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold uppercase text-amber-300 border border-amber-500/30">
                            Checkout Open
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Device */}
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
                        {row.deviceAvailability.toLowerCase().includes("laptop") ? (
                          <Laptop className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Smartphone className="h-3 w-3 text-zinc-400" />
                        )}
                        <span className="capitalize">{row.deviceAvailability.slice(0, 10)}</span>
                      </span>
                    </td>

                    {/* Registered Date */}
                    <td className="px-3 py-3 text-zinc-400">
                      <div>{new Date(row.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(row.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => setSelectedRegId(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-900/60 transition"
                      >
                        <Eye className="h-3 w-3" />
                        <span>CRM & Notes</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-2 border-t border-emerald-950/80 bg-black/40 px-4 py-3 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {data.items.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, data.total)} of {data.total} matching leads
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

      {/* Lead Detail & Follow-up Drawer */}
      {selectedRegId && (
        <RegistrationDetailDrawer
          authToken={authToken}
          registrationId={selectedRegId}
          onClose={() => {
            setSelectedRegId(null);
            fetchRegistrations(true);
          }}
        />
      )}
    </div>
  );
}

/**
 * ============================================================================
 * REGISTRATION & LEAD CRM DETAIL DRAWER COMPONENT
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
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [leadStatus, setLeadStatus] = useState("new");
  const [isRead, setIsRead] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await (getAdminRegistrationDetail as any)({
        data: { authToken, id: registrationId },
      });
      if (res && res.ok) {
        setDetail(res.data);
        setLeadStatus(res.data.leadStatus || "new");
        setIsRead(res.data.isRead || false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [authToken, registrationId]);

  const copyId = () => {
    navigator.clipboard.writeText(registrationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add note & save in real-time
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;

    try {
      setSavingNote(true);
      const res = await (updateAdminLeadStatus as any)({
        data: {
          authToken,
          registrationId,
          note: noteInput.trim(),
          isRead: true,
        },
      });

      if (res && res.ok) {
        setNoteInput("");
        await fetchDetail();
      }
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  // Update Status directly in drawer
  const handleDrawerStatusChange = async (newStatus: string) => {
    setLeadStatus(newStatus);
    setIsRead(true);
    try {
      await (updateAdminLeadStatus as any)({
        data: {
          authToken,
          registrationId,
          leadStatus: newStatus,
          isRead: true,
        },
      });
      await fetchDetail();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  // Toggle Read directly in drawer
  const handleDrawerReadToggle = async () => {
    const nextRead = !isRead;
    setIsRead(nextRead);
    try {
      await (updateAdminLeadStatus as any)({
        data: {
          authToken,
          registrationId,
          isRead: nextRead,
        },
      });
      await fetchDetail();
    } catch (err) {
      console.error("Read update error:", err);
    }
  };

  const phoneDigits = detail
    ? (detail.phone_country_code + detail.phone_number).replace(/\D/g, "")
    : "";
  const waText = encodeURIComponent(
    "Hello! This is from PenduGPT Masterclass. We saw you registered for our training. How can we help you get started?",
  );
  const waUrl = `https://wa.me/${phoneDigits}?text=${waText}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-emerald-950/80 bg-[#030a06] text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-emerald-950/80 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-white">Lead CRM Profile</h3>
            <p className="text-xs text-zinc-400">Complete interaction log & journey</p>
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
              {/* Status & Quick Action Card */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Lead Status</span>
                  <button
                    onClick={handleDrawerReadToggle}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                      isRead
                        ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    }`}
                  >
                    {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
                    <span>{isRead ? "Mark as Unread" : "Mark as Read"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: "new", label: "New Lead", color: "hover:border-blue-500" },
                    { id: "followed_up", label: "Followed Up", color: "hover:border-purple-500" },
                    { id: "in_discussion", label: "In Discussion", color: "hover:border-amber-500" },
                    { id: "callback", label: "Callback", color: "hover:border-cyan-500" },
                    { id: "converted", label: "Converted", color: "hover:border-green-500" },
                    { id: "not_interested", label: "Not Interested", color: "hover:border-zinc-500" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleDrawerStatusChange(s.id)}
                      className={`rounded-lg border p-2 text-center text-[11px] font-bold transition ${
                        leadStatus === s.id
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                          : "border-emerald-950/60 bg-black/40 text-zinc-400 " + s.color
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Direct Contact Links */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-950/60">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>WhatsApp Chat</span>
                  </a>

                  <a
                    href={`tel:${detail.phone_country_code || "+91"}${detail.phone_number}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-900/60 bg-emerald-950/30 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Call Number</span>
                  </a>
                </div>
              </div>

              {/* ID & Phone Info */}
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

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-950/60">
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
                  <div>
                    <span className="text-[11px] text-zinc-500">Gender</span>
                    <p className="text-sm font-semibold text-white">
                      {detail.gender || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* CRM Follow-up Notes Box */}
              <div className="rounded-xl border border-emerald-950/70 bg-black/40 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Admin Follow-Up Notes & History</span>
                </h4>

                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Type follow-up note (e.g. called customer, joining live batch on Saturday)..."
                    className="w-full rounded-lg border border-emerald-950/80 bg-black/70 p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingNote || !noteInput.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 transition disabled:opacity-40"
                  >
                    <Send className="h-3 w-3" />
                    <span>{savingNote ? "Saving Note..." : "Save Note to Database"}</span>
                  </button>
                </form>

                {/* Notes Timeline */}
                <div className="space-y-2 pt-2 border-t border-emerald-950/60 max-h-48 overflow-y-auto">
                  {detail.notesTimeline && detail.notesTimeline.length > 0 ? (
                    detail.notesTimeline.map((n: any) => (
                      <div key={n.id} className="rounded-lg border border-emerald-950/60 bg-emerald-950/15 p-2.5 text-xs">
                        <p className="text-zinc-200">{n.note}</p>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : detail.admin_notes ? (
                    <div className="rounded-lg border border-emerald-950/60 bg-emerald-950/15 p-2.5 text-xs text-zinc-200">
                      {detail.admin_notes}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">No notes recorded yet for this lead.</p>
                  )}
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
                      <div className="text-[10px] text-zinc-500">
                        Last Synced: {new Date(vp.updated_at).toLocaleString()}
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
  const [pageSize, setPageSize] = useState(15);
  const [data, setData] = useState<any>({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [syncingRzp, setSyncingRzp] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchOrders = async (triggerSync = false) => {
    try {
      setLoading(true);
      setAuthError(null);

      if (triggerSync) {
        setSyncingRzp(true);
        try {
          await (syncRazorpayPayments as any)({ data: { authToken } });
        } catch {
          /* ignore */
        } finally {
          setSyncingRzp(false);
        }
      }

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
    fetchOrders(false);
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
              placeholder=""
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
            onClick={() => fetchOrders(true)}
            disabled={syncingRzp || loading}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            title="Sync all live payments from Razorpay"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingRzp ? "animate-spin" : ""}`} />
            <span>{syncingRzp ? "Syncing..." : "Sync Razorpay"}</span>
          </button>

          <button
            onClick={() => fetchOrders(false)}
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
              <th className="px-4 py-3 font-semibold">Customer / Phone</th>
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
                  <p className="text-xs text-zinc-600">Click &quot;Sync Razorpay&quot; to fetch live transactions.</p>
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
        <p className="mt-1 text-xs text-zinc-400">Current authenticated session</p>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-black/40 p-3 text-xs">
            <span className="text-zinc-400">Account:</span>
            <span className="font-semibold text-emerald-400">{userEmail}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-black/40 p-3 text-xs">
            <span className="text-zinc-400">Access Level:</span>
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 border border-emerald-500/30">
              Master Admin
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

      {/* Security Policies Audit */}
      <div className="rounded-xl border border-emerald-950/70 bg-[#040d08]/80 p-6">
        <h3 className="text-base font-bold text-white">Security & Access Control</h3>
        <div className="mt-3 space-y-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Row Level Security (RLS) is active on all tables.</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Direct public client queries on customer data are blocked.</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>All dashboard metrics, tables and exports are verified on the backend.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
