import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LifeBuoy,
  X,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  CreditCard,
  Sparkles,
} from "lucide-react";

export const SupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Expanded Support Popup */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 w-80 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Customer Support</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Agents online 24/7</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
            Have a question about Google Pay billing, AI auto-cuts, or YouTube video rendering?
          </p>

          <div className="space-y-2 mb-3">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/support");
              }}
              className="w-full p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition flex items-center justify-between shadow-md shadow-amber-400/10"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open Support Ticket</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/help");
              }}
              className="w-full p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Guides & Documentation</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/support");
              }}
              className="w-full p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Pay & Billing Help</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex items-center justify-between">
            <span>Avg Response: &lt; 2 hours</span>
            <Link
              to="/support"
              onClick={() => setIsOpen(false)}
              className="text-amber-400 hover:underline font-medium"
            >
              Full Support Desk
            </Link>
          </div>
        </div>
      )}

      {/* Floating Pill Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-white text-xs font-bold shadow-xl shadow-black/40 hover:scale-105 active:scale-95 transition group"
        title="Need help? Customer Support"
      >
        <div className="relative">
          <LifeBuoy className="w-4 h-4 text-emerald-400 group-hover:rotate-45 transition-transform duration-300" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-zinc-900" />
        </div>
        <span className="hidden sm:inline">Support</span>
      </button>
    </div>
  );
};
