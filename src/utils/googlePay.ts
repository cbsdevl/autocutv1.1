/**
 * Google Pay Helper and Utilities for AutoCut AI
 * Formats API requests, initializes client payment configurations, and interacts with backend checkout.
 */

export interface GooglePayPublicConfig {
  environment: "TEST" | "PRODUCTION";
  merchantName: string;
  merchantId: string;
  gateway: string;
  gatewayMerchantId: string;
  allowedCardNetworks: string[];
  allowedCardAuthMethods: string[];
}

export interface GooglePayTransactionResult {
  id: string;
  plan: string;
  planSlug: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  cardNetwork?: string;
  cardLast4?: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export const DEFAULT_GPAY_CONFIG: GooglePayPublicConfig = {
  environment: "TEST",
  merchantName: "AutoCut AI",
  merchantId: "12345678901234567890",
  gateway: "example",
  gatewayMerchantId: "exampleGatewayMerchantId",
  allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX", "DISCOVER"],
  allowedCardAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
};

/**
 * Fetch Google Pay configuration from the server
 */
export async function fetchGooglePayConfig(): Promise<GooglePayPublicConfig> {
  try {
    const res = await fetch("/api/payments/config");
    if (res.ok) {
      const data = await res.json();
      return {
        environment: data.environment || "TEST",
        merchantName: data.merchantName || "AutoCut AI",
        merchantId: data.merchantId || "12345678901234567890",
        gateway: data.gateway || "example",
        gatewayMerchantId: data.gatewayMerchantId || "exampleGatewayMerchantId",
        allowedCardNetworks: data.allowedCardNetworks || ["VISA", "MASTERCARD", "AMEX", "DISCOVER"],
        allowedCardAuthMethods: data.allowedCardAuthMethods || ["PAN_ONLY", "CRYPTOGRAM_3DS"],
      };
    }
  } catch {
    // Fallback to default config
  }
  return DEFAULT_GPAY_CONFIG;
}

/**
 * Build Google Pay paymentDataRequest for a given plan
 */
export function buildGooglePayPaymentDataRequest(
  plan: { name: string; slug: string; price: number; currency?: string },
  config: GooglePayPublicConfig = DEFAULT_GPAY_CONFIG
): any {
  const currencyCode = (plan.currency || "USD").toUpperCase();
  const totalPrice = plan.price.toFixed(2);

  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: "CARD",
        parameters: {
          allowedAuthMethods: config.allowedCardAuthMethods,
          allowedCardNetworks: config.allowedCardNetworks,
          billingAddressRequired: true,
          billingAddressParameters: {
            format: "MIN",
          },
        },
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: {
            gateway: config.gateway,
            gatewayMerchantId: config.gatewayMerchantId,
          },
        },
      },
    ],
    merchantInfo: {
      merchantId: config.merchantId,
      merchantName: config.merchantName,
    },
    transactionInfo: {
      displayItems: [
        {
          label: `${plan.name} Subscription Plan`,
          type: "LINE_ITEM",
          price: totalPrice,
          currencyCode,
        },
      ],
      totalPriceStatus: "FINAL",
      totalPriceLabel: "Total Subscription Price",
      totalPrice,
      currencyCode,
      countryCode: "US",
    },
  };
}

/**
 * Send Google Pay token payload to backend for subscription upgrade & receipt creation
 */
export async function submitGooglePayCheckout(params: {
  planSlug: string;
  paymentData?: any;
  simulated?: boolean;
}): Promise<{ ok: boolean; transaction?: GooglePayTransactionResult; error?: string }> {
  try {
    const res = await fetch("/api/payments/google-pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, transaction: data.transaction };
    }
    return { ok: false, error: data.error || "Google Pay payment failed." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error during Google Pay checkout.",
    };
  }
}
