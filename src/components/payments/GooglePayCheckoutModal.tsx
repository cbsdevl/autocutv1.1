import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Download,
  Calendar,
  Sparkles,
  Loader2,
  Film,
} from "lucide-react";
import { GooglePayButtonWrapper } from "./GooglePayButtonWrapper";
import { GooglePayMark } from "./GooglePayMark";
import { submitGooglePayCheckout, GooglePayTransactionResult } from "../../utils/googlePay";
import { useAuth } from "../../context/AuthContext";

export interface CheckoutPlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency?: string;
  duration_days?: number;
  ai_video_limit?: number;
  description?: string;
}

interface GooglePayCheckoutModalProps {
  isOpen: boolean;
  plan: CheckoutPlan | null;
  onClose: () => void;
  onPaymentComplete?: (transaction: GooglePayTransactionResult) => void;
}

export const GooglePayCheckoutModal: React.FC<GooglePayCheckoutModalProps> = ({
  isOpen,
  plan,
  onClose,
  onPaymentComplete,
}) => {
  const { currentUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedTransaction, setCompletedTransaction] = useState<GooglePayTransactionResult | null>(null);

  if (!isOpen || !plan) return null;

  const handlePaymentSuccess = async (paymentData: any, isSimulated = false) => {
    setIsProcessing(true);
    setErrorMessage(null);

    const result = await submitGooglePayCheckout({
      planSlug: plan.slug,
      paymentData,
      simulated: isSimulated,
    });

    setIsProcessing(false);

    if (result.ok && result.transaction) {
      setCompletedTransaction(result.transaction);
      await refreshUser();
      if (onPaymentComplete) {
        onPaymentComplete(result.transaction);
      }
    } else {
      setErrorMessage(result.error || "Payment verification failed.");
    }
  };

  const handleDownloadReceipt = () => {
    if (!completedTransaction) return;
    const content = `===========================================
AUTOCUT AI - SUBSCRIPTION PAYMENT RECEIPT
===========================================
Transaction ID: ${completedTransaction.id}
Date:           ${new Date(completedTransaction.createdAt).toLocaleString()}
Plan:           ${completedTransaction.plan}
Amount:         $${completedTransaction.amount.toFixed(2)} ${completedTransaction.currency}
Payment Method: ${completedTransaction.paymentMethod} (${completedTransaction.cardNetwork || "CARD"} •••• ${completedTransaction.cardLast4 || "4242"})
Status:         ${completedTransaction.status.toUpperCase()}
Customer:       ${currentUser?.name || "Subscriber"} (${currentUser?.email || ""})
Expires At:     ${completedTransaction.expiresAt ? new Date(completedTransaction.expiresAt).toLocaleDateString() : "Never"}
===========================================
Thank you for creating videos with AutoCut AI!
===========================================`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt_${completedTransaction.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            {/* Official Google Pay Acceptance Mark */}
            <GooglePayMark withPill height={18} theme="light" />
            <span className="text-xs text-zinc-400 font-medium">Checkout</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {completedTransaction ? (
            /* Success Receipt View */
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-in zoom-in duration-300">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                Subscription Activated!
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                Your payment was securely verified and processed via Google Pay.
              </p>

              {/* Receipt Box */}
              <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 text-left text-xs space-y-2.5 mb-6">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Transaction ID</span>
                  <span className="font-mono text-zinc-200">{completedTransaction.id}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Subscription Tier</span>
                  <span className="font-bold text-white">{completedTransaction.plan}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Amount Paid</span>
                  <span className="font-bold text-emerald-400">
                    ${completedTransaction.amount.toFixed(2)} {completedTransaction.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Payment Method</span>
                  <span className="text-zinc-200 flex items-center gap-1.5">
                    Google Pay · {completedTransaction.cardNetwork || "CARD"} •••• {completedTransaction.cardLast4 || "4242"}
                  </span>
                </div>
                {completedTransaction.expiresAt && (
                  <div className="flex items-center justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                    <span>Renewal / Expiration</span>
                    <span className="text-zinc-300">
                      {new Date(completedTransaction.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  onClick={handleDownloadReceipt}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Receipt</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate("/editor");
                  }}
                  className="w-full sm:w-1/2 py-2.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Open Video Studio</span>
                </button>
              </div>
            </div>
          ) : (
            /* Checkout Order Summary & Google Pay Button */
            <div>
              {/* Plan Card */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 mb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Selected Plan
                    </span>
                    <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">
                      ${plan.price.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      {plan.duration_days ? `/ ${plan.duration_days} days` : "/ month"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mb-3">{plan.description}</p>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    AI Video Limit:
                  </span>
                  <span className="font-semibold text-white">
                    {plan.ai_video_limit && plan.ai_video_limit >= 9999
                      ? "Unlimited generations"
                      : `${plan.ai_video_limit || 50} videos`}
                  </span>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Processing Loader */}
              {isProcessing ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Authorizing with Google Pay…
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Upgrading your AutoCut AI account and unlocking premium features.
                    </p>
                  </div>
                </div>
              ) : (
                /* Google Pay Button Section */
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Pay with Google Pay</span>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" /> 256-bit encrypted
                    </span>
                  </div>

                  <GooglePayButtonWrapper
                    plan={plan}
                    onSuccess={handlePaymentSuccess}
                    onError={(err) => setErrorMessage(err)}
                    disabled={isProcessing}
                  />

                  <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Secure tokenized checkout</span>
                    <span>No card details stored on server</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
