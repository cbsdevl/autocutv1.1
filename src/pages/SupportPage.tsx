import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LifeBuoy,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  HelpCircle,
  CreditCard,
  Film,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  User,
  LogIn,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  plan_tier: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface Message {
  id: number;
  ticket_id: number;
  sender_role: "user" | "admin" | "system";
  sender_name: string;
  message: string;
  created_at: string;
}

export const SupportPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const catParam = searchParams.get("category");

  const [activeTab, setActiveTab] = useState<"new" | "tickets" | "faq">(
    tabParam === "tickets" ? "tickets" : tabParam === "faq" ? "faq" : "new"
  );
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(catParam || "billing");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // FAQ Search
  const [faqQuery, setFaqQuery] = useState("");

  const loadTickets = async () => {
    if (!currentUser) return;
    setLoadingTickets(true);
    try {
      const res = await fetch("/api/support/tickets", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadTickets();
    }
  }, [currentUser]);

  const loadTicketThread = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      navigate("/login?redirect=/support");
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setFormFeedback({ type: "error", text: "Please provide both a subject and details for your ticket." });
      return;
    }

    setIsSubmitting(true);
    setFormFeedback(null);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setFormFeedback({
          type: "success",
          text: `Support ticket ${data.ticket.ticket_number} created! Our team will review your inquiry shortly.`,
        });
        setSubject("");
        setMessage("");
        await loadTickets();
        // Switch to ticket view
        setSelectedTicket(data.ticket);
        loadTicketThread(data.ticket);
        setActiveTab("tickets");
      } else {
        setFormFeedback({ type: "error", text: data.error || "Failed to submit ticket." });
      }
    } catch {
      setFormFeedback({ type: "error", text: "Network error submitting support request." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);

    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyText.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setReplyText("");
        await loadTickets();
      }
    } catch {
      // non-fatal
    } finally {
      setSendingReply(false);
    }
  };

  const FAQS = [
    {
      q: "How does Google Pay subscription billing work?",
      a: "Google Pay securely authorizes recurring monthly or weekly payments with 256-bit tokenized security. Your card details are never saved on our server, and you can manage or upgrade your plan anytime from the Pricing page.",
      cat: "Billing",
    },
    {
      q: "My video export or rendering is taking longer than expected",
      a: "High-resolution 4K or 60fps renders take more processing time depending on the length and effects used. Try exporting in 1080p for faster processing or ensure you maintain a stable internet connection for priority cloud queues.",
      cat: "Export",
    },
    {
      q: "How does the AI Silence Removal threshold work?",
      a: "Silence detection scans the audio waveform for sections where decibels fall below your chosen threshold (default -32 dB). You can adjust this in the AI Auto-Cut modal to preserve natural pauses or achieve rapid pacing.",
      cat: "AI Features",
    },
    {
      q: "Will my video get flagged by YouTube Content ID?",
      a: "AutoCut AI's built-in Copyright Safety Center analyzes all audio against verified royalty-free databases and commercial rights standards, giving you a pre-upload risk score so you can publish safely.",
      cat: "Copyright",
    },
    {
      q: "Can I transfer my project to another computer?",
      a: "Yes! Use the 'Export Archive' button in your project options to download a self-contained .autocut.zip file. You can import this file on any machine using AutoCut AI.",
      cat: "General",
    },
    {
      q: "What are the support hours and response times?",
      a: "Our customer support team operates 24/7. Pro and Agency subscribers enjoy priority queue routing with typical responses within 1 to 2 hours.",
      cat: "General",
    },
  ];

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(faqQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(faqQuery.toLowerCase()) ||
      f.cat.toLowerCase().includes(faqQuery.toLowerCase())
  );

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

          <nav className="hidden sm:flex items-center gap-4 text-xs font-semibold text-zinc-400">
            <Link to="/editor" className="hover:text-white transition">Studio</Link>
            <Link to="/projects" className="hover:text-white transition">Projects</Link>
            <Link to="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link to="/help" className="hover:text-white transition">Guides</Link>
            <span className="text-amber-400">Support</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
          >
            <Film className="w-3.5 h-3.5" />
            Launch Studio
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Support Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <LifeBuoy className="w-3.5 h-3.5" />
            Customer Support & Help Desk
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            How can we help you today?
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Our team is here to assist with billing, Google Pay checkouts, video exports, and AI workflow inquiries.
          </p>

          {/* SLA banner */}
          <div className="mt-4 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 font-medium">
                Live Support Desk: <strong className="text-white">Active 24/7</strong>
              </span>
              <span className="text-zinc-500 hidden sm:inline">·</span>
              <span className="text-zinc-400 hidden sm:inline">
                Avg Response: <strong className="text-emerald-400">&lt; 2 hrs</strong>
              </span>
            </div>

            {currentUser && (
              <div className="text-zinc-400 flex items-center gap-1.5">
                <span>Logged in as:</span>
                <span className="text-amber-400 font-semibold">{currentUser.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                  {currentUser.plan_name} Tier
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 border-b border-zinc-800 pb-3 mb-6">
          <button
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "new"
                ? "bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20"
                : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Open New Ticket</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("tickets");
              loadTickets();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "tickets"
                ? "bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20"
                : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>My Tickets ({tickets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("faq")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "faq"
                ? "bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20"
                : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Instant FAQs</span>
          </button>
        </div>

        {/* ── TAB 1: NEW TICKET FORM ── */}
        {activeTab === "new" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-bold text-white mb-1">Submit a Support Ticket</h2>
              <p className="text-xs text-zinc-400 mb-6">
                Fill in the details below and a dedicated support agent will review your request.
              </p>

              {!currentUser && (
                <div className="p-4 mb-6 rounded-xl bg-amber-400/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>You are browsing as a guest. Please sign in or register to submit and track support tickets.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/login?redirect=/support"
                      className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold hover:bg-amber-300 transition flex items-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Sign In
                    </Link>
                    <Link
                      to="/register?redirect=/support"
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 font-semibold hover:bg-zinc-700 transition"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              )}

              {formFeedback && (
                <div
                  className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start gap-3 mb-6 ${
                    formFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  }`}
                >
                  {formFeedback.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  <span>{formFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Subject / Summary *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Issue with Google Pay checkout or 4K export"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Inquiry Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="billing">Billing & Google Pay</option>
                      <option value="export">Video Export & Rendering</option>
                      <option value="autocut">AI Auto-Cut & Silence Removal</option>
                      <option value="copyright">Copyright Safety & YouTube Content ID</option>
                      <option value="account">Account & Video Generation Quotas</option>
                      <option value="feature">Feature Suggestion / Feedback</option>
                      <option value="general">General Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Urgency / Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="low">Low (General question)</option>
                      <option value="medium">Medium (Standard request)</option>
                      <option value="high">High (Impacting production)</option>
                      <option value="urgent">Urgent (Payment or blocking failure)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Detailed Description *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please describe what happened, steps to reproduce, or transaction details…"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">
                    Includes automatic account tier diagnostic info
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-amber-400 hover:bg-amber-300 text-zinc-950 transition flex items-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Support Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Contact Info & Direct Channels */}
            <div className="space-y-4">
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Google Pay Support
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Have a question regarding your recent Google Pay transaction or subscription upgrade? Include your transaction ID (e.g. <code className="text-amber-400">gpay_...</code>) for rapid lookup.
                </p>
                <Link
                  to="/account"
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <span>View payment history</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                <h3 className="font-bold text-white text-sm mb-2">Priority Response Times</h3>
                <ul className="space-y-2 text-xs text-zinc-400">
                  <li className="flex items-center justify-between">
                    <span>Agency Tier:</span>
                    <strong className="text-emerald-400">Immediate (&lt; 1 hr)</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Pro Tier:</span>
                    <strong className="text-sky-400">&lt; 2 hours</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>Free Tier:</span>
                    <strong className="text-zinc-300">Within 12 hours</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MY TICKETS & CONVERSATION THREAD ── */}
        {activeTab === "tickets" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket List */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-white">Your Tickets</h2>
                <button
                  onClick={loadTickets}
                  className="p-1 rounded text-zinc-400 hover:text-white transition"
                  title="Refresh tickets"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {!currentUser ? (
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
                  <User className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-300 font-semibold mb-1">Account Sign In Required</p>
                  <p className="text-[11px] text-zinc-400 mb-3">Please sign in to view your open support tickets and replies.</p>
                  <Link
                    to="/login?redirect=/support?tab=tickets"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs hover:bg-amber-300 transition"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In to View Tickets</span>
                  </Link>
                </div>
              ) : loadingTickets ? (
                <div className="py-12 flex justify-center text-zinc-400">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
                  <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 mb-2">No tickets submitted yet.</p>
                  <button
                    onClick={() => setActiveTab("new")}
                    className="text-xs text-amber-400 font-semibold hover:underline"
                  >
                    Open your first ticket →
                  </button>
                </div>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => loadTicketThread(t)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? "bg-zinc-800/90 border-amber-400/50 shadow-md shadow-amber-400/5"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[10px] text-zinc-400">{t.ticket_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            t.status === "open"
                              ? "bg-amber-400/10 text-amber-400 border border-amber-400/30"
                              : t.status === "in_progress"
                              ? "bg-sky-400/10 text-sky-400 border border-sky-400/30"
                              : "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                          }`}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-xs line-clamp-1 mb-1">{t.subject}</h4>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="capitalize">{t.category}</span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Conversation Thread */}
            <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col min-h-[460px] overflow-hidden">
              {selectedTicket ? (
                <>
                  {/* Thread Header */}
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-amber-400">{selectedTicket.ticket_number}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300">
                          {selectedTicket.priority} Priority
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{selectedTicket.subject}</h3>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          selectedTicket.status === "open"
                            ? "bg-amber-400/10 text-amber-400 border border-amber-400/30"
                            : selectedTicket.status === "in_progress"
                            ? "bg-sky-400/10 text-sky-400 border border-sky-400/30"
                            : "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30"
                        }`}
                      >
                        {selectedTicket.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px]">
                    {loadingMessages ? (
                      <div className="py-12 flex justify-center text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isAdmin = m.sender_role === "admin";
                        const isSystem = m.sender_role === "system";
                        return (
                          <div
                            key={m.id}
                            className={`p-3.5 rounded-xl text-xs ${
                              isSystem
                                ? "bg-emerald-950/20 border border-emerald-500/25 text-emerald-100"
                                : isAdmin
                                ? "bg-amber-400/10 border border-amber-400/20 text-zinc-200 mr-6"
                                : "bg-zinc-800/80 border border-zinc-700/80 text-zinc-200 ml-6"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5 text-[11px]">
                              <span className="font-bold flex items-center gap-1.5">
                                {isSystem ? (
                                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                                    <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
                                    Support Desk System
                                  </span>
                                ) : isAdmin ? (
                                  <span className="text-amber-400">AutoCut Support Specialist</span>
                                ) : (
                                  <span className="text-white">{m.sender_name} (You)</span>
                                )}
                              </span>
                              <span className="text-zinc-500 font-mono text-[10px]">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">{m.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Reply Input */}
                  <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                      placeholder="Type a reply to customer support…"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Reply</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                  <MessageSquare className="w-10 h-10 mb-2 text-zinc-700" />
                  <p className="text-sm font-semibold text-zinc-400">No ticket selected</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Select a ticket from the left panel to read the conversation or send a response.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: INSTANT FAQS ── */}
        {activeTab === "faq" && (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                placeholder="Search common issues, billing, exports…"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFaqs.map((f, i) => (
                <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      {f.cat}
                    </span>
                    <h3 className="font-bold text-white text-sm">{f.q}</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-bold text-white text-sm">Can&apos;t find the answer you need?</p>
                <p className="text-zinc-400 text-xs mt-0.5">
                  Open a ticket and an AutoCut technical agent will investigate directly.
                </p>
              </div>

              <button
                onClick={() => setActiveTab("new")}
                className="px-4 py-2 rounded-xl font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition flex items-center gap-1.5 shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Contact Agent</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
