import React, { useState, useEffect } from "react";
import GooglePayButton from "@google-pay/button-react";
import { Loader2, ShieldCheck, Sparkles, CreditCard } from "lucide-react";
import {
  DEFAULT_GPAY_CONFIG,
  fetchGooglePayConfig,
  buildGooglePayPaymentDataRequest,
  GooglePayPublicConfig,
} from "../../utils/googlePay";

interface GooglePayButtonWrapperProps {
  plan: {
    id: number;
    name: string;
    slug: string;
    price: number;
    currency?: string;
  };
  onSuccess: (paymentData: any, isSimulated?: boolean) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export const GooglePayButtonWrapper: React.FC<GooglePayButtonWrapperProps> = ({
  plan,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const [config, setConfig] = useState<GooglePayPublicConfig>(DEFAULT_GPAY_CONFIG);
  const [ready, setReady] = useState(false);
  const [hasGooglePayError, setHasGooglePayError] = useState(false);

  useEffect(() => {
    fetchGooglePayConfig()
      .then((cfg) => {
        setConfig(cfg);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="h-11 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center gap-2 text-xs text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        <span>Initializing Google Pay…</span>
      </div>
    );
  }

  const paymentRequest = buildGooglePayPaymentDataRequest(plan, config);

  return (
    <div className="w-full flex flex-col items-center gap-2.5">
      {/* Official Google Pay Web Button */}
      <div className="w-full relative overflow-hidden rounded-lg min-h-[44px]">
        <GooglePayButton
          environment={config.environment}
          paymentRequest={paymentRequest}
          onLoadPaymentData={(paymentData) => {
            onSuccess(paymentData, false);
          }}
          onError={(error) => {
            console.warn("[Google Pay] Web button event error:", error);
            setHasGooglePayError(true);
          }}
          buttonColor="white"
          buttonType="subscribe"
          buttonSizeMode="fill"
          style={{ width: "100%", height: 44, display: "block" }}
        />
      </div>

      {/* Instant Sandbox / Developer Test Fallback */}
      <div className="w-full flex flex-col items-center gap-1.5 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            // Simulated authorized Google Pay token payload
            const mockGPayToken = {
              apiVersion: 2,
              apiVersionMinor: 0,
              paymentMethodData: {
                type: "CARD",
                description: "Google Pay (Visa •••• 4242)",
                info: {
                  cardNetwork: "VISA",
                  cardDetails: "4242",
                },
                tokenizationData: {
                  type: "PAYMENT_GATEWAY",
                  token: `gpay_tok_${Date.now()}_test`,
                },
              },
            };
            onSuccess(mockGPayToken, true);
          }}
          className="w-full py-2 px-3 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-[11px] text-zinc-300 font-medium transition flex items-center justify-center gap-1.5"
          title="Simulate Google Pay transaction using test card token"
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
          <span>One-Click Test Pay (Visa •••• 4242)</span>
        </button>

        <p className="text-[10px] text-zinc-500 text-center flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
          Google Pay Sandbox Mode · Zero real charge
        </p>
      </div>
    </div>
  );
};
