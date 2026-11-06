import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  User,
  Mail,
  Shield,
  Zap,
  Calendar,
  Clock,
  LogOut,
  FolderOpen,
  ArrowRight,
  Crown,
  CheckCircle2,
  HardDrive,
  CreditCard,
  Download,
  Receipt,
  LifeBuoy,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authFetch } from "../utils/authClient";
import { listProjectsForUser } from "../utils/projectStorage";

interface PaymentItem {
  id: number;
  plan_slug: string;
  plan_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  card_network?: string;
  card_last4?: string;
  status: string;
  created_at: string;
}

export const AccountPage: React.FC = () => {
  const { currentUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [projectCount, setProjectCount] = useState<number>(0);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (currentUser) {
      listProjectsForUser(currentUser.id)
        .then((list) => setProjectCount(list.length))
        .catch(() => {});
      refreshUser().catch(() => {});

      setLoadingPayments(true);
      authFetch("/api/payments/history")
        .then((r) => r.json())
        .then((data) => {
          setPayments(data.payments || []);
        })
        .catch(() => {})
        .finally(() => setLoadingPayments(false));
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const isUnlimited = currentUser.ai_video_limit >= 9999 || currentUser.plan_slug === "agency";
  const used = currentUser.ai_videos_used;
  const limit = currentUser.ai_video_limit;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleDownloadReceipt = (p: PaymentItem) => {
    const text = `===========================================
AUTOCUT AI - PAYMENT RECEIPT
===========================================
Transaction ID: ${p.transaction_id}
Date:           ${new Date(p.created_at).toLocaleString()}
Plan:           ${p.plan_name}
Amount:         $${p.amount.toFixed(2)} ${p.currency}
Payment Method: Google Pay (${p.card_network || "CARD"} •••• ${p.card_last4 || "4242"})
Status:         ${p.status.toUpperCase()}
Customer:       ${currentUser?.name} (${currentUser?.email})
===========================================
Thank you for subscribing with Google Pay!
===========================================`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt_${p.transaction_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-zinc-950 font-bold shadow-md shadow-amber-400/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">AutoCut AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/editor"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Studio
            </Link>
            <Link
              to="/projects"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/pricing"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Guides
            </Link>
            {currentUser.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 transition-colors flex items-center gap-1"
              >
                <Crown className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
          >
            <Film className="w-3.5 h-3.5" />
            Launch Studio
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Account & Subscription
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage your profile, plan limits, AI quotas, and active video projects.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="md:col-span-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center">
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                className="w-20 h-20 rounded-2xl border-2 border-amber-400/40 shadow-xl shadow-amber-400/20 mb-4 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl font-black text-zinc-950 shadow-xl shadow-amber-400/20 mb-4">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className="text-lg font-bold text-white">{currentUser.name}</h2>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-xs text-zinc-400">{currentUser.email}</p>
              {currentUser.email_verified ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Email Domain & MX Verified">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              ) : null}
            </div>

            {currentUser.google_id && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium text-blue-300 mb-3">
                <svg className="w-3 h-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google Account Linked</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-300 mb-6">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Role: <strong className="text-white capitalize">{currentUser.role}</strong></span>
            </div>

            <div className="w-full pt-4 border-t border-zinc-800 flex flex-col gap-2">
              <Link
                to="/projects"
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 text-xs font-medium text-zinc-300 transition"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  My Projects
                </span>
                <span className="font-mono text-zinc-400">{projectCount}</span>
              </Link>

              {currentUser.role === "admin" && (
                <Link
                  to="/admin"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 text-xs font-medium text-purple-300 transition"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    Admin Panel
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition mt-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Subscription & Usage Card */}
          <div className="md:col-span-2 space-y-6">
            {/* Plan details */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {currentUser.plan_name} Plan
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Active Subscription Tier
                    </p>
                  </div>
                </div>

                <Link
                  to="/pricing"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
                >
                  {currentUser.plan_slug === "free" ? "Upgrade" : "Change Plan"}
                </Link>
              </div>

              {/* Quota Progress */}
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-zinc-300">AI Video Generation Quota</span>
                  <span className="font-mono text-zinc-400">
                    {isUnlimited ? (
                      <span className="text-emerald-400 font-semibold">Unlimited</span>
                    ) : (
                      `${used} / ${limit} used`
                    )}
                  </span>
                </div>

                {!isUnlimited && (
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        percentage >= 100
                          ? "bg-red-500"
                          : percentage >= 75
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}

                <p className="text-[11px] text-zinc-500 mt-2">
                  {isUnlimited
                    ? "Your Agency tier includes unlimited AI auto-remix cuts and beat syncing."
                    : `${Math.max(0, limit - used)} generation credits remaining this billing cycle.`}
                </p>
              </div>
            </div>

            {/* Storage & Specs */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-zinc-400" />
                Browser Local Storage & Sync
              </h3>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Projects and video clips are stored safely in your browser database using IndexedDB. You can export complete project zip packages for backup or transfer between computers.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-500 block mb-0.5">Local Projects</span>
                  <span className="font-bold text-white text-base">{projectCount}</span>
                </div>
                <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-500 block mb-0.5">Render Engine</span>
                  <span className="font-bold text-emerald-400 text-base">FFmpeg & Canvas</span>
                </div>
              </div>
            </div>

            {/* Google Pay Payment History & Invoices */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Google Pay Transactions & Receipts</h3>
                </div>
                <Link
                  to="/pricing"
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
                >
                  Subscription Plans →
                </Link>
              </div>

              {payments.length === 0 ? (
                <div className="bg-zinc-950/60 rounded-xl p-5 border border-zinc-800/80 text-center">
                  <p className="text-xs text-zinc-400 mb-2">No payment transactions recorded yet.</p>
                  <p className="text-[11px] text-zinc-500">
                    When you subscribe using Google Pay, your verified receipts and invoices will be stored here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white">{p.plan_name} Plan</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {p.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                          <span>Google Pay ({p.card_network || "CARD"} •••• {p.card_last4 || "4242"})</span>
                          <span>•</span>
                          <span className="font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="font-bold text-white text-sm">
                          ${p.amount.toFixed(2)} {p.currency}
                        </span>

                        <button
                          onClick={() => handleDownloadReceipt(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 transition flex items-center gap-1.5"
                          title="Download Receipt Text File"
                        >
                          <Download className="w-3 h-3 text-amber-400" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Support & Assistance Card */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <LifeBuoy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Customer Support & Help Desk</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-xl">
                      Need help managing your Google Pay subscription, resolving render issues, or requesting an AI quota increase? Our support engineers are on standby 24/7.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Link
                    to="/support?tab=tickets"
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
                  >
                    View My Tickets
                  </Link>
                  <Link
                    to="/support"
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-400/10"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Get Support</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
