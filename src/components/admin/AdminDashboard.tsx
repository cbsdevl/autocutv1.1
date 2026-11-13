import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowLeft, BarChart3, CalendarDays, Check, ChevronDown,
  CreditCard, DollarSign, Edit3, Loader2, RefreshCw, Save, Search,
  Shield, Trash2, Users, AlertCircle, Crown, ExternalLink,
  LifeBuoy, MessageSquare, Send, Tag, Clock, Plus, X, Lock, Sparkles
} from "lucide-react";
import { authFetch } from "../../utils/authClient";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_videos_used: number;
  ai_video_limit: number;
  created_at: string;
  expires_at: string | null;
}

interface PlanAdmin {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  description: string;
  updated_at: string;
}

type AdminTab = "overview" | "users" | "plans" | "payments" | "support";

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<PlanAdmin[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentStats, setPaymentStats] = useState<{ totalRevenue: number; totalTransactions: number } | null>(null);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportStats, setSupportStats] = useState<{ total: number; open: number; inProgress: number; resolved: number } | null>(null);
  const [selectedAdminTicket, setSelectedAdminTicket] = useState<any | null>(null);
  const [adminTicketMessages, setAdminTicketMessages] = useState<any[]>([]);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [adminTicketFilter, setAdminTicketFilter] = useState("all");
  const [loadingTicketThread, setLoadingTicketThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planEdits, setPlanEdits] = useState<Record<number, Partial<PlanAdmin>>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState<PlanAdmin | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    name: "",
    slug: "",
    price: "",
    currency: "USD",
    duration_days: 30,
    ai_video_limit: "25",
    is_unlimited: false,
    description: "",
  });

  const flash = (type: "success" | "error", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const loadUsers = useCallback(async () => {
    const res = await authFetch("/api/admin/users");
    if (!res.ok) throw new Error(res.status === 403 ? "Admin access required." : "Could not load accounts.");
    const d = await res.json();
    setUsers(d.users || []);
  }, []);

  const loadPlans = useCallback(async () => {
    const res = await authFetch("/api/admin/plans");
    if (!res.ok) throw new Error(res.status === 403 ? "Admin access required." : "Could not load plans.");
    const d = await res.json();
    setPlans(d.plans || []);
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/payments");
      if (res.ok) {
        const d = await res.json();
        setPayments(d.payments || []);
        setPaymentStats(d.stats || null);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const loadSupportTickets = useCallback(async (statusFilter = adminTicketFilter) => {
    try {
      const url = statusFilter && statusFilter !== "all"
        ? `/api/admin/support/tickets?status=${statusFilter}`
        : `/api/admin/support/tickets`;
      const res = await authFetch(url);
      if (res.ok) {
        const d = await res.json();
        setSupportTickets(d.tickets || []);
        setSupportStats(d.stats || null);
      }
    } catch {
      // non-fatal
    }
  }, [adminTicketFilter]);

  const loadAdminTicketMessages = async (ticket: any) => {
    setSelectedAdminTicket(ticket);
    setLoadingTicketThread(true);
    try {
      const res = await authFetch(`/api/support/tickets/${ticket.id}`);
      if (res.ok) {
        const d = await res.json();
        setAdminTicketMessages(d.messages || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingTicketThread(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: number, status: string, priority?: string) => {
    try {
      const res = await authFetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority }),
      });
      if (res.ok) {
        flash("success", "Ticket status updated.");
        loadSupportTickets();
        if (selectedAdminTicket?.id === ticketId) {
          setSelectedAdminTicket((prev: any) => ({ ...prev, status }));
        }
      }
    } catch {
      flash("error", "Failed to update ticket status.");
    }
  };

  const handleAdminReply = async () => {
    if (!selectedAdminTicket || !adminReplyText.trim()) return;
    try {
      const res = await authFetch(`/api/support/tickets/${selectedAdminTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: adminReplyText.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setAdminTicketMessages((prev) => [...prev, d.message]);
        setAdminReplyText("");
        flash("success", "Reply sent to customer.");
        loadSupportTickets();
      }
    } catch {
      flash("error", "Failed to send reply.");
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(), loadPlans(), loadPayments(), loadSupportTickets()])
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not load admin data."))
      .finally(() => setLoading(false));
  }, [loadUsers, loadPlans, loadPayments, loadSupportTickets]);

  // ── User Actions ──────────────────────────────────────────

  const handleRoleChange = async (userId: number, newRole: "user" | "admin") => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) { flash("success", "Role updated."); loadUsers(); }
    else flash("error", "Failed to update role.");
  };

  const handlePlanChange = async (userId: number, planSlug: string) => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug }),
    });
    if (res.ok) { flash("success", "Plan updated."); loadUsers(); }
    else flash("error", "Failed to update plan.");
  };

  const handleDeleteUser = async (userId: number) => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) { flash("success", "User deleted."); setConfirmDelete(null); loadUsers(); }
    else flash("error", "Failed to delete user.");
  };

  // ── Plan Actions ──────────────────────────────────────────

  const handleSavePlan = async (plan: PlanAdmin) => {
    const edits = planEdits[plan.id] || {};
    try {
      const res = await authFetch(`/api/admin/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        flash("success", `${edits.name || plan.name} plan saved.`);
        setEditingPlan(null);
        setPlanEdits((prev) => { const n = { ...prev }; delete n[plan.id]; return n; });
        loadPlans();
      } else {
        flash("error", data.error || "Failed to save plan.");
      }
    } catch (err: any) {
      flash("error", err.message || "Failed to save plan.");
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanForm.name.trim()) {
      flash("error", "Plan name is required.");
      return;
    }
    const numPrice = parseFloat(newPlanForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      flash("error", "Please provide a valid non-negative price (e.g. 0 or 19.99).");
      return;
    }

    setIsSubmittingPlan(true);
    try {
      const res = await authFetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlanForm.name.trim(),
          slug: newPlanForm.slug.trim() || undefined,
          price: numPrice,
          currency: newPlanForm.currency || "USD",
          duration_days: Number(newPlanForm.duration_days) || 0,
          ai_video_limit: newPlanForm.is_unlimited ? 999999 : (parseInt(newPlanForm.ai_video_limit, 10) || 10),
          description: newPlanForm.description.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create pricing plan.");
      }

      flash("success", `Plan "${newPlanForm.name}" created successfully!`);
      setIsAddPlanOpen(false);
      setNewPlanForm({
        name: "",
        slug: "",
        price: "",
        currency: "USD",
        duration_days: 30,
        ai_video_limit: "25",
        is_unlimited: false,
        description: "",
      });
      loadPlans();
    } catch (err: any) {
      flash("error", err.message || "Failed to create plan.");
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: PlanAdmin) => {
    setIsDeletingPlan(true);
    try {
      const res = await authFetch(`/api/admin/plans/${plan.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete pricing plan.");
      }

      flash("success", `Plan "${plan.name}" deleted successfully.`);
      setConfirmDeletePlan(null);
      loadPlans();
    } catch (err: any) {
      flash("error", err.message || "Failed to delete plan.");
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const planColors: Record<string, string> = {
    free: "border-gray-500/30",
    weekly: "border-blue-500/30",
    monthly: "border-purple-500/30",
    pro: "border-amber-500/30",
    agency: "border-emerald-500/30",
  };

  const metrics = useMemo(() => {
    const now = Date.now();
    const paidAccounts = users.filter((user) =>
      user.plan_slug !== "free" && (!user.expires_at || new Date(user.expires_at).getTime() > now)
    ).length;
    const aiGenerations = users.reduce((total, user) => total + (Number(user.ai_videos_used) || 0), 0);
    const admins = users.filter((user) => user.role === "admin").length;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const count = users.filter((user) => {
        const createdAt = new Date(`${user.created_at.replace(" ", "T")}Z`);
        return !Number.isNaN(createdAt.getTime()) && createdAt.toISOString().slice(0, 10) === key;
      }).length;
      return { label: date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }), count };
    });
    const planMix = plans.map((plan) => ({
      ...plan,
      count: users.filter((user) => user.plan_slug === plan.slug).length,
    }));

    return { paidAccounts, aiGenerations, admins, days, planMix };
  }, [users, plans]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    );
  }, [users, userSearch]);

  return (
    <div className="min-h-screen w-full bg-[#090d12] text-slate-100">
      <div className="min-h-screen w-full max-w-[1440px] mx-auto border-x border-white/5">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
              <p className="text-xs text-gray-500">Manage users, plans & pricing</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-white/20 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Return to editor
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-white/8 bg-black/20">
          {(["overview", "users", "plans", "payments", "support"] as AdminTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize
                ${tab === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              {t === "overview" ? <BarChart3 className="w-4 h-4" /> : t === "users" ? <Users className="w-4 h-4" /> : t === "plans" ? <CreditCard className="w-4 h-4" /> : t === "payments" ? <DollarSign className="w-4 h-4 text-emerald-400" /> : <LifeBuoy className="w-4 h-4 text-sky-400" />}
              {t === "payments" ? "Google Pay & Revenue" : t === "support" ? `Customer Support (${supportStats?.open ?? 0})` : t}
            </button>
          ))}
          <button onClick={() => { loadUsers(); loadPlans(); loadPayments(); loadSupportTickets(); }}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Flash message */}
        {actionMsg && (
            <div className={`mx-6 mt-4 flex items-center gap-2 rounded-md px-4 py-2.5 text-sm
            ${actionMsg.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {actionMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {actionMsg.text}
          </div>
        )}

        {loadError && (
          <div className="mx-6 mt-5 flex items-center gap-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        )}

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (

            /* ────────── USERS TAB ────────── */
            tab === "overview" ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: "Total accounts", value: users.length, detail: "All registered accounts", Icon: Users, color: "text-sky-300", tone: "bg-sky-400/10" },
                    { label: "Paid-tier accounts", value: metrics.paidAccounts, detail: "Currently unexpired plans", Icon: CreditCard, color: "text-emerald-300", tone: "bg-emerald-400/10" },
                    { label: "AI generations", value: metrics.aiGenerations, detail: "Recorded across accounts", Icon: Activity, color: "text-amber-300", tone: "bg-amber-400/10" },
                    { label: "Administrators", value: metrics.admins, detail: "Accounts with admin access", Icon: Shield, color: "text-rose-300", tone: "bg-rose-400/10" },
                  ].map(({ label, value, detail, Icon, color, tone }) => (
                    <div key={label} className="min-w-0 border border-white/8 bg-[#11171e] p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p>
                        </div>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone} ${color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
                  <section className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Account growth</h3>
                        <p className="mt-1 text-xs text-slate-500">New registrations · last 7 days</p>
                      </div>
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-6 grid h-44 grid-cols-7 gap-2 sm:gap-4" role="img" aria-label="New account registrations over the last seven days">
                      {metrics.days.map((day) => {
                        const maxCount = Math.max(1, ...metrics.days.map((item) => item.count));
                        const barHeight = day.count ? Math.max(10, (day.count / maxCount) * 100) : 3;
                        return (
                          <div key={day.label} className="flex min-w-0 flex-col items-center justify-end gap-2">
                            <span className="text-[11px] tabular-nums text-slate-400">{day.count || ""}</span>
                            <div className="flex h-32 w-full items-end border-b border-white/10">
                              <div className="w-full rounded-t-sm bg-gradient-to-t from-sky-600/70 to-cyan-300" style={{ height: `${barHeight}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500">{day.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Plan distribution</h3>
                        <p className="mt-1 text-xs text-slate-500">Current accounts by plan</p>
                      </div>
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-6 space-y-5">
                      {metrics.planMix.map((plan) => {
                        const percentage = users.length ? (plan.count / users.length) * 100 : 0;
                        const barColor = plan.slug === "monthly" ? "bg-emerald-400" : plan.slug === "weekly" ? "bg-sky-400" : "bg-slate-500";
                        return (
                          <div key={plan.slug}>
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-300">{plan.name}</span>
                              <span className="tabular-nums text-slate-400">{plan.count} <span className="text-slate-600">· {Math.round(percentage)}%</span></span>
                            </div>
                            <div className="h-1.5 overflow-hidden bg-white/5">
                              <div className={`h-full ${barColor}`} style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="border-t border-white/8 pt-4 text-xs leading-relaxed text-slate-500">
                        Plan assignment is shown as account status; payment transactions are not tracked here.
                      </p>
                    </div>
                  </section>
                </div>

                <section className="overflow-hidden border border-white/8 bg-[#11171e]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-4 sm:px-5">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Recent accounts</h3>
                      <p className="mt-1 text-xs text-slate-500">Latest registrations</p>
                    </div>
                    <button onClick={() => setTab("users")} className="text-xs font-medium text-sky-300 hover:text-sky-200">View all accounts</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 font-medium sm:px-5">Account</th>
                          <th className="px-4 py-3 font-medium">Plan</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.slice(0, 5).map((user) => (
                          <tr key={user.id} className="border-b border-white/5 last:border-0">
                            <td className="px-4 py-3 sm:px-5">
                              <p className="font-medium text-slate-200">{user.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{user.plan_name || "Free"}</td>
                            <td className="px-4 py-3 text-slate-400">{user.role}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(`${user.created_at.replace(" ", "T")}Z`).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">No accounts registered yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : tab === "users" ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-300">Accounts <span className="ml-1 text-slate-500">{filteredUsers.length}</span></h3>
                  <label className="relative block w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name or email"
                      className="w-full border border-white/10 bg-[#11171e] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none" />
                  </label>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Plan</th>
                        <th className="text-left px-4 py-3">AI Videos</th>
                        <th className="text-left px-4 py-3">Expires</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as "user" | "admin")}
                                className="appearance-none bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white pr-6 cursor-pointer focus:outline-none focus:border-purple-500">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={u.plan_slug || "free"}
                                onChange={(e) => handlePlanChange(u.id, e.target.value)}
                                className="appearance-none bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white pr-6 cursor-pointer focus:outline-none focus:border-purple-500">
                                {plans.map((p) => (
                                  <option key={p.slug} value={p.slug}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-300">{u.ai_videos_used}</span>
                            <span className="text-gray-600"> / {u.ai_video_limit >= 999999 ? "∞" : u.ai_video_limit}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {confirmDelete === u.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-red-400 mr-1">Confirm?</span>
                                <button onClick={() => handleDeleteUser(u.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white">Yes</button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-gray-300">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)}
                                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-10">No users found.</p>
                  )}
                </div>
              </div>
            ) : tab === "plans" ? (

              /* ────────── PLANS TAB ────────── */
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-400" />
                      <span>Pricing Plans & Subscriptions</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Configure customer tiers, prices, billing frequency, and AI generation allowances.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddPlanOpen(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-950/40 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Plan</span>
                  </button>
                </div>

                {/* Add Plan Modal */}
                {isAddPlanOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#12141c] border border-white/12 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-zinc-100 flex flex-col max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base">Add New Pricing Plan</h4>
                            <p className="text-xs text-gray-400">Create a new subscription tier for users</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAddPlanOpen(false)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleCreatePlan} className="space-y-4">
                        {/* Name and Slug */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-300 mb-1 block">Plan Name *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Creator Pro"
                              value={newPlanForm.name}
                              onChange={(e) => {
                                const name = e.target.value;
                                const autoSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                                setNewPlanForm((prev) => ({
                                  ...prev,
                                  name,
                                  slug: prev.slug === "" || prev.slug === prev.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                                    ? autoSlug
                                    : prev.slug,
                                }));
                              }}
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-300 mb-1 block">Plan Identifier (Slug) *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. creator-pro"
                              value={newPlanForm.slug}
                              onChange={(e) => setNewPlanForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") }))}
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        {/* Price and Duration */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-300 mb-1 block">Price (USD) *</label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="19.99 (0 for free)"
                                value={newPlanForm.price}
                                onChange={(e) => setNewPlanForm((prev) => ({ ...prev, price: e.target.value }))}
                                className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-300 mb-1 block">Billing Cycle</label>
                            <select
                              value={newPlanForm.duration_days}
                              onChange={(e) => setNewPlanForm((prev) => ({ ...prev, duration_days: parseInt(e.target.value, 10) }))}
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                            >
                              <option value={30}>Monthly (30 days)</option>
                              <option value={7}>Weekly (7 days)</option>
                              <option value={14}>Bi-Weekly (14 days)</option>
                              <option value={90}>Quarterly (90 days)</option>
                              <option value={365}>Annual / Yearly (365 days)</option>
                              <option value={0}>Lifetime / No Expiration (0 days)</option>
                            </select>
                          </div>
                        </div>

                        {/* AI Video Limit & Unlimited toggle */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-300">AI Video Generation Limit</label>
                            <label className="flex items-center gap-1.5 text-xs text-purple-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newPlanForm.is_unlimited}
                                onChange={(e) => setNewPlanForm((prev) => ({ ...prev, is_unlimited: e.target.checked }))}
                                className="rounded border-white/20 text-purple-600 focus:ring-0"
                              />
                              <span>Unlimited generations</span>
                            </label>
                          </div>
                          {!newPlanForm.is_unlimited ? (
                            <input
                              type="number"
                              min="1"
                              value={newPlanForm.ai_video_limit}
                              onChange={(e) => setNewPlanForm((prev) => ({ ...prev, ai_video_limit: e.target.value }))}
                              placeholder="e.g. 50"
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                            />
                          ) : (
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
                              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                              <span>Subscribers receive unlimited automated AI generations & exports</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-xs font-medium text-gray-300 mb-1 block">Description & Features</label>
                          <textarea
                            rows={3}
                            placeholder="e.g. 50 AI auto-edits, 4K exports, beat sync, and priority render queue."
                            value={newPlanForm.description}
                            onChange={(e) => setNewPlanForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500 resize-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setIsAddPlanOpen(false)}
                            disabled={isSubmittingPlan}
                            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 rounded-xl text-xs font-semibold transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingPlan}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-900/40 transition disabled:opacity-50 cursor-pointer"
                          >
                            {isSubmittingPlan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Create Plan</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const isEditing = editingPlan === plan.id;
                    const edits = planEdits[plan.id] || {};
                    const val = (key: keyof PlanAdmin) => (edits as Record<string, unknown>)[key] ?? plan[key];

                    return (
                      <div
                        key={plan.id}
                        className={`bg-[#1a1a24] border ${planColors[plan.slug] || "border-indigo-500/30"} rounded-xl p-5 flex flex-col justify-between gap-4 transition-all`}
                      >
                        <div className="space-y-4">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={String(val("name"))}
                                  onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], name: e.target.value } }))}
                                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-2.5 py-1 text-white text-sm font-bold focus:outline-none focus:border-purple-500"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-white text-base">{plan.name}</h4>
                                  <span className="font-mono text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                    {plan.slug}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSavePlan(plan)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs text-white font-medium transition-colors"
                                  >
                                    <Save className="w-3 h-3" /> Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingPlan(null);
                                      setPlanEdits((p) => {
                                        const n = { ...p };
                                        delete n[plan.id];
                                        return n;
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditingPlan(plan.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white/8 hover:bg-white/15 rounded-lg text-xs text-gray-300 transition-colors"
                                  >
                                    <Edit3 className="w-3 h-3" /> Edit
                                  </button>

                                  {plan.slug === "free" ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 border border-white/10 px-2 py-1 rounded-lg"
                                      title="System base plan cannot be deleted"
                                    >
                                      <Lock className="w-3 h-3 text-gray-500" /> Default
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDeletePlan(plan)}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg text-xs transition-colors cursor-pointer"
                                      title="Delete Plan"
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Delete Confirmation Box */}
                          {confirmDeletePlan?.id === plan.id && (
                            <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 flex flex-col gap-2.5 animate-in fade-in">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-white">Delete &quot;{plan.name}&quot;?</p>
                                  <p className="text-[11px] text-red-300/80 mt-0.5">
                                    Subscribers will be safely reverted to the Free tier. Payment history will be preserved.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-500/20">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePlan(null)}
                                  disabled={isDeletingPlan}
                                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-xs transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlan(plan)}
                                  disabled={isDeletingPlan}
                                  className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-xs transition shadow-md shadow-red-950/50"
                                >
                                  {isDeletingPlan && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Yes, Delete</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Price */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Price (USD)</label>
                            {isEditing ? (
                              <div className="relative">
                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={String(val("price"))}
                                  onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], price: parseFloat(e.target.value) } }))}
                                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                                />
                              </div>
                            ) : (
                              <p className="text-2xl font-bold text-white">
                                {plan.price === 0 ? "Free" : `$${plan.price.toFixed(2)}`}
                                {plan.price > 0 && (
                                  <span className="text-sm font-normal text-gray-500 ml-1">
                                    /{plan.duration_days === 7 ? "week" : plan.duration_days === 365 ? "year" : plan.duration_days === 0 ? "lifetime" : "month"}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>

                          {/* Billing Cycle Duration */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Billing Duration (Days)</label>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={String(val("duration_days"))}
                                onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], duration_days: parseInt(e.target.value, 10) } }))}
                                className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-gray-300">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                <span>{plan.duration_days === 0 ? "Lifetime / No Expiration" : `${plan.duration_days} days cycle`}</span>
                              </div>
                            )}
                          </div>

                          {/* AI Video Limit */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">AI Video Limit</label>
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={String(val("ai_video_limit"))}
                                  onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], ai_video_limit: parseInt(e.target.value, 10) } }))}
                                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], ai_video_limit: 999999 } }))}
                                  className="text-[11px] text-purple-400 hover:text-purple-300 transition"
                                >
                                  Set to Unlimited (999,999)
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                <span className="font-medium">
                                  {plan.ai_video_limit >= 999999 ? "Unlimited Generations" : `${plan.ai_video_limit} AI Generations`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Description */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">Description</label>
                            {isEditing ? (
                              <textarea
                                rows={2}
                                value={String(val("description"))}
                                onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], description: e.target.value } }))}
                                className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                              />
                            ) : (
                              <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-gray-600 pt-2 border-t border-white/5">
                          Last updated: {new Date(plan.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : tab === "payments" ? (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <span className="text-xs text-gray-400 block mb-1">Total Revenue</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      ${paymentStats?.totalRevenue ? paymentStats.totalRevenue.toFixed(2) : "0.00"}
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-1">Processed via Google Pay</span>
                  </div>

                  <div className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <span className="text-xs text-gray-400 block mb-1">Completed Transactions</span>
                    <span className="text-2xl font-bold text-white">
                      {paymentStats?.totalTransactions ?? payments.length}
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-1">Successful authorizations</span>
                  </div>

                  <div className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <span className="text-xs text-gray-400 block mb-1">Payment Method</span>
                    <span className="text-2xl font-bold text-amber-400">Google Pay</span>
                    <span className="text-[11px] text-gray-500 block mt-1">Tokenized Web API</span>
                  </div>
                </div>

                {/* Google Pay Status & Setup Banner */}
                <div className="border border-white/8 bg-[#11171e] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">Google Pay API Integration</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/30">
                          SANDBOX (TEST MODE)
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Tokenized transactions and test cards enabled. To accept real customer payments, link your merchant ID in the Google Pay Console.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/gpay-buyflow"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-bold text-zinc-950 transition"
                    >
                      <span>Buyflow Screenshot Kit</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    <a
                      href="https://pay.google.com/business/console"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 transition"
                    >
                      <span>Google Pay Console</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>
                  </div>
                </div>

                {/* Payments Table */}
                <div className="border border-white/8 bg-[#11171e] overflow-hidden">
                  <div className="p-4 border-b border-white/8 flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Google Pay Transaction Records</h3>
                    <span className="text-xs text-gray-400">{payments.length} total</span>
                  </div>

                  {payments.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                      No Google Pay transactions recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-black/30 border-b border-white/8 text-gray-400">
                          <tr>
                            <th className="py-2.5 px-4 font-medium">Customer</th>
                            <th className="py-2.5 px-4 font-medium">Plan</th>
                            <th className="py-2.5 px-4 font-medium">Amount</th>
                            <th className="py-2.5 px-4 font-medium">Payment Method</th>
                            <th className="py-2.5 px-4 font-medium">Transaction ID</th>
                            <th className="py-2.5 px-4 font-medium">Date</th>
                            <th className="py-2.5 px-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {payments.map((p) => (
                            <tr key={p.id} className="hover:bg-white/[0.02]">
                              <td className="py-3 px-4">
                                <div className="font-medium text-white">{p.user_name || "User"}</div>
                                <div className="text-[11px] text-gray-500">{p.user_email || `ID: ${p.user_id}`}</div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-white">
                                {p.plan_name}
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-400">
                                ${p.amount.toFixed(2)} {p.currency}
                              </td>
                              <td className="py-3 px-4 text-gray-300">
                                Google Pay ({p.card_network || "CARD"} •••• {p.card_last4 || "4242"})
                              </td>
                              <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">
                                {p.transaction_id}
                              </td>
                              <td className="py-3 px-4 text-gray-400">
                                {new Date(p.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {p.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : tab === "support" ? (
              <div className="space-y-6">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="border border-white/8 bg-[#11171e] p-4">
                    <span className="text-xs text-amber-400 block mb-1">Open Tickets</span>
                    <span className="text-2xl font-bold text-white">{supportStats?.open ?? 0}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">Awaiting first response</span>
                  </div>
                  <div className="border border-white/8 bg-[#11171e] p-4">
                    <span className="text-xs text-sky-400 block mb-1">In Progress</span>
                    <span className="text-2xl font-bold text-white">{supportStats?.inProgress ?? 0}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">Active customer threads</span>
                  </div>
                  <div className="border border-white/8 bg-[#11171e] p-4">
                    <span className="text-xs text-emerald-400 block mb-1">Resolved</span>
                    <span className="text-2xl font-bold text-white">{supportStats?.resolved ?? 0}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">Completed inquiries</span>
                  </div>
                  <div className="border border-white/8 bg-[#11171e] p-4">
                    <span className="text-xs text-gray-400 block mb-1">Total Received</span>
                    <span className="text-2xl font-bold text-white">{supportStats?.total ?? 0}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">All time</span>
                  </div>
                </div>

                {/* Filter and Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Tickets List */}
                  <div className="lg:col-span-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Tickets</h3>
                      <select
                        value={adminTicketFilter}
                        onChange={(e) => {
                          setAdminTicketFilter(e.target.value);
                          loadSupportTickets(e.target.value);
                        }}
                        className="bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {supportTickets.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-500 border border-white/8 bg-[#11171e] rounded-xl">
                          No tickets found with this status.
                        </div>
                      ) : (
                        supportTickets.map((t) => {
                          const isSelected = selectedAdminTicket?.id === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() => loadAdminTicketMessages(t)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                                isSelected
                                  ? "bg-white/10 border-sky-400/50"
                                  : "border-white/8 bg-[#11171e] hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1 text-[10px]">
                                <span className="font-mono text-gray-400">{t.ticket_number}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    t.status === "open"
                                      ? "bg-amber-400/10 text-amber-400"
                                      : t.status === "in_progress"
                                      ? "bg-sky-400/10 text-sky-400"
                                      : "bg-emerald-400/10 text-emerald-400"
                                  }`}
                                >
                                  {t.status.replace("_", " ")}
                                </span>
                              </div>
                              <h4 className="font-bold text-white text-xs line-clamp-1 mb-1">{t.subject}</h4>
                              <div className="flex items-center justify-between text-[11px] text-gray-400">
                                <span className="truncate max-w-[120px]">{t.user_name}</span>
                                <span className="text-[10px] text-gray-500 capitalize">{t.category}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Conversation Thread & Actions */}
                  <div className="lg:col-span-2 border border-white/8 bg-[#11171e] rounded-xl flex flex-col min-h-[500px] overflow-hidden">
                    {selectedAdminTicket ? (
                      <>
                        <div className="p-4 border-b border-white/8 bg-black/20 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs text-sky-400">{selectedAdminTicket.ticket_number}</span>
                              <span className="text-xs text-gray-400">· {selectedAdminTicket.user_name} ({selectedAdminTicket.user_email})</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-gray-300">
                                {selectedAdminTicket.plan_tier} Tier
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white">{selectedAdminTicket.subject}</h3>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={selectedAdminTicket.status}
                              onChange={(e) => handleUpdateTicketStatus(selectedAdminTicket.id, e.target.value)}
                              className="bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>

                        {/* Thread Messages */}
                        <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]">
                          {loadingTicketThread ? (
                            <div className="py-12 flex justify-center text-gray-400">
                              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                            </div>
                          ) : (
                            adminTicketMessages.map((m) => {
                              const isAdmin = m.sender_role === "admin";
                              return (
                                <div
                                  key={m.id}
                                  className={`p-3.5 rounded-xl text-xs ${
                                    isAdmin
                                      ? "bg-purple-500/10 border border-purple-500/20 text-gray-200 ml-6"
                                      : "bg-white/5 border border-white/10 text-gray-200 mr-6"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1.5 text-[11px]">
                                    <span className="font-bold flex items-center gap-1.5">
                                      {isAdmin ? (
                                        <span className="text-purple-400">Support Agent (You)</span>
                                      ) : (
                                        <span className="text-white">{m.sender_name} (Customer)</span>
                                      )}
                                    </span>
                                    <span className="text-gray-500 font-mono text-[10px]">
                                      {new Date(m.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="whitespace-pre-wrap leading-relaxed text-gray-300">{m.message}</p>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Admin Reply Box */}
                        <div className="p-3 border-t border-white/8 bg-black/30 flex items-center gap-2">
                          <input
                            type="text"
                            value={adminReplyText}
                            onChange={(e) => setAdminReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdminReply()}
                            placeholder="Type a response to this customer…"
                            className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                          />
                          <button
                            onClick={handleAdminReply}
                            disabled={!adminReplyText.trim()}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Reply</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                        <LifeBuoy className="w-10 h-10 mb-2 text-gray-700" />
                        <p className="text-sm font-semibold text-gray-400">Select a support ticket</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Click any ticket on the left to review inquiry details, reply to customers, or update status.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};
