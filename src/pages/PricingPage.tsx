import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  Zap,
  Check,
  Star,
  Shield,
  Sparkles,
  ArrowRight,
  Loader2,
  Crown,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Layers,
  CreditCard,
  LifeBuoy,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GooglePayCheckoutModal, CheckoutPlan } from "../components/payments/GooglePayCheckoutModal";
import { GooglePayMark } from "../components/payments/GooglePayMark";

interface Plan {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  description: string;
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "2 AI Auto-cut generations per month",
    "Full multi-track timeline editor",
    "1080p Full HD video exports",
    "Royalty-free music & SFX library",
    "Standard subtitle & caption generator",
    "Basic YouTube Content ID audit",
  ],
  weekly: [
    "10 AI Auto-cuts per week",
    "Full 1080p & 4K video exports",
    "Silence removal & beat sync",
    "YouTube Content ID pre-check",
    "Automated chapter markers",
    "Pay with Google Pay",
  ],
  monthly: [
    "Unlimited AI Auto-cut generations",
    "Full 4K Ultra HD video exports",
    "AI Speech silence removal & beat sync",
    "Deep YouTube Content ID strike pre-check",
    "Automated chapter markers & SEO package",
    "Priority cloud rendering queue",
    "Pay with Google Pay",
  ],
  pro: [
    "50 AI Auto-cut generations per month",
    "Full 4K Ultra HD video exports",
    "AI Speech silence removal & beat sync",
    "Deep YouTube Content ID strike pre-check",
    "Automated chapter markers & SEO package",
    "Priority cloud rendering queue",
    "Pay with Google Pay",
  ],
  agency: [
    "Unlimited AI Auto-cut video generations",
    "Uncompressed 4K 60fps export pipeline",
    "Multi-project batch export archive",
    "Enterprise Content ID rights scanner",
    "Fastest dedicated render servers",
    "Dedicated 24/7 priority support",
    "Pay with Google Pay",
  ],
};

const FAQS = [
  {
    q: "How does the AI Auto-cut quota work?",
    a: "Every time you run an automated AI remix, auto-cut silences, or beat-sync workflow, 1 generation credit is used. Manual timeline editing and video trims are always 100% unlimited on all plans.",
  },
  {
    q: "Can I cancel or switch my plan at any time?",
    a: "Yes! Upgrades take effect immediately so you can generate more videos without delay. You can change plans at any time.",
  },
  {
    q: "How does the YouTube Content ID pre-check protect me?",
    a: "AutoCut AI analyzes all audio tracks, spectrograms, and media metadata against verified royalty-free libraries and commercial music databases, highlighting high-risk audio before you publish to YouTube.",
  },
  {
    q: "What export resolutions are supported?",
    a: "Free plans export in crisp 1080p Full HD. Pro and Agency plans support up to 4K Ultra HD with selectable 16:9, 9:16 Shorts, and 1:1 formats.",
  },
];

export const PricingPage: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingSlug, setUpgradingSlug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [gpayCheckoutPlan, setGpayCheckoutPlan] = useState<CheckoutPlan | null>(null);

  useEffect(() => {
    fetch("/api/plans", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleOpenGooglePay = (plan: Plan) => {
    if (!currentUser) {
      navigate(`/login?redirect=/pricing`);
      return;
    }
    setGpayCheckoutPlan(plan);
  };

  const handleUpgrade = async (planSlug: string) => {
    if (!currentUser) {
      navigate(`/login?redirect=/pricing`);
      return;
    }

    if (planSlug === currentUser.plan_slug) return;

    setUpgradingSlug(planSlug);
    setFeedback(null);

    try {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `Congratulations! Your account was upgraded to the ${data.plan} plan.`,
        });
        await refreshUser();
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Failed to upgrade subscription plan.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error while processing upgrade.",
      });
    } finally {
      setUpgradingSlug(null);
    }
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
              className="px-3 py-1.5 rounded-md text-amber-400 bg-amber-400/10 font-semibold"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Guides
            </Link>
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
          {currentUser ? (
            <Link
              to="/account"
              className="flex items-center gap-2 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition text-xs"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-amber-400">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline font-medium text-zinc-300">{currentUser.name}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Supercharge Your Video Production
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Create high-engagement YouTube and social videos with intelligent AI cuts, beat sync, and copyright safety.
          </p>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl border text-sm flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Pricing Cards Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-sm">Loading subscription plans…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-20">
            {plans.map((plan) => {
              const isCurrent = currentUser?.plan_slug === plan.slug;
              const isPro = plan.slug === "pro";
              const isAgency = plan.slug === "agency";
              const features = PLAN_FEATURES[plan.slug] || [];

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all relative ${
                    isPro
                      ? "bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-400/70 shadow-2xl shadow-amber-400/10 md:-translate-y-2"
                      : "bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-950 text-[11px] font-extrabold uppercase px-3 py-0.5 rounded-full tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-400 text-xs sm:text-sm mb-6 min-h-[36px]">
                      {plan.description}
                    </p>

                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-extrabold text-white">
                        ${plan.price}
                      </span>
                      <span className="text-zinc-400 text-xs">/month</span>
                    </div>

                    <div className="space-y-3 mb-8">
                      <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                        Included Features
                      </div>
                      {features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                          <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/60 cursor-default"
                      >
                        Active Plan
                      </button>
                    ) : plan.slug === "free" ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-800 cursor-default"
                      >
                        Free Forever
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {/* Primary Google Pay Button */}
                        <button
                          onClick={() => handleOpenGooglePay(plan)}
                          className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold bg-white hover:bg-zinc-100 text-zinc-950 transition flex items-center justify-center gap-2 shadow-lg shadow-white/10 cursor-pointer"
                        >
                          <span className="font-semibold text-zinc-900">Buy with</span>
                          <GooglePayMark height={20} theme="light" />
                        </button>

                        <button
                          onClick={() => handleUpgrade(plan.slug)}
                          disabled={upgradingSlug !== null}
                          className="w-full py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 transition flex items-center justify-center gap-1.5"
                        >
                          {upgradingSlug === plan.slug ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Upgrading…
                            </>
                          ) : (
                            <>
                              <Zap className="w-3 h-3 text-amber-400" />
                              Quick Upgrade
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Google Pay Checkout Modal */}
        <GooglePayCheckoutModal
          isOpen={gpayCheckoutPlan !== null}
          plan={gpayCheckoutPlan}
          onClose={() => setGpayCheckoutPlan(null)}
          onPaymentComplete={(transaction) => {
            setFeedback({
              type: "success",
              text: `Payment confirmed via Google Pay! You are now subscribed to ${transaction.plan}.`,
            });
          }}
        />

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto border-t border-zinc-800 pt-14">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          {/* Customer Support Callout */}
          <div className="mt-8 p-6 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-900/90 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Have questions about Google Pay billing or team quotas?</h4>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  Our customer support team is available 24/7 to help verify payment receipts, upgrade workspaces, or assist with enterprise onboarding.
                </p>
              </div>
            </div>

            <Link
              to="/support?category=billing"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition shadow-md shadow-amber-400/10 shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
