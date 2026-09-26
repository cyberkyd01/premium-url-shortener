import type { Coupon, Plan, Subscription, User } from "@prisma/client";

export type Interval = "monthly" | "yearly" | "lifetime";
export const INTERVALS: Interval[] = ["monthly", "yearly", "lifetime"];

export interface BillingInfo {
  name?: string;
  email?: string;
  address?: string;
  city?: string;
  zip?: string;
  country?: string; // ISO2
  state?: string;
  vat?: string;
}

export interface CheckoutParams {
  user: User;
  plan: Plan;
  interval: Interval;
  /** Final amount to charge (after discount and tax). */
  amount: number;
  currency: string;
  coupon?: Coupon | null;
  /** Tax percentage applied (0 when disabled). */
  taxRate: number;
  /** Absolute tax amount included in `amount`. */
  tax: number;
  /** Absolute discount subtracted from the plan price. */
  discount: number;
  billing: BillingInfo;
  successUrl: string;
  cancelUrl: string;
  /** Our pending Payment id; gateways pass it back in webhooks as the reference. */
  paymentId: string;
}

export type CheckoutResult =
  | { url: string }
  | { clientSecret: string; publicKey?: string; extra?: Record<string, string> }
  | { pending: true; message: string };

export interface PaymentEvent {
  type: "payment" | "subscription_cancelled" | "subscription_updated" | "refund" | "ignored";
  /** Our pending Payment id when the gateway sent it back. */
  paymentId?: string;
  userId?: string;
  planId?: string;
  interval?: Interval;
  amount?: number;
  currency?: string;
  transactionId?: string;
  couponCode?: string;
  gatewaySubId?: string;
  currentPeriodEnd?: Date;
  status?: string;
  note?: string;
}

export interface Gateway {
  slug: string;
  name: string;
  supportsSubscriptions: boolean;
  /** Human readable list of config keys stored in PaymentGateway.config. */
  configKeys: string[];
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  handleWebhook(req: Request): Promise<PaymentEvent[]>;
  cancelSubscription(sub: Subscription): Promise<void>;
  /** Optional: create products/prices on the provider side and store ids on Plan. */
  syncPlans?(): Promise<{ synced: number }>;
  /** Optional: refund a completed payment on the provider side. */
  refund?(transactionId: string, amount?: number): Promise<void>;
  /** Optional: undo a pending cancellation (subscription continues). */
  resumeSubscription?(sub: Subscription): Promise<void>;
}

export class GatewayError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Encodes our checkout reference for gateways without metadata support. */
export function encodeRef(data: { paymentId: string; userId: string; planId: string; interval: Interval; couponCode?: string | null }) {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}
export function decodeRef(ref: string | null | undefined): { paymentId: string; userId: string; planId: string; interval: Interval; couponCode?: string | null } | null {
  if (!ref) return null;
  try {
    const d = JSON.parse(Buffer.from(ref, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof d.paymentId !== "string" || typeof d.userId !== "string" || typeof d.planId !== "string") return null;
    return { paymentId: d.paymentId, userId: d.userId, planId: d.planId, interval: (d.interval as Interval) ?? "monthly", couponCode: typeof d.couponCode === "string" ? d.couponCode : null };
  } catch {
    return null;
  }
}

/** Reads a gateway credential from the PaymentGateway.config JSON with env fallback. */
export function cfg(config: Record<string, string>, key: string, envKey?: string) {
  const v = config[key];
  if (v && v.trim()) return v.trim();
  if (envKey && process.env[envKey]) return String(process.env[envKey]);
  return "";
}

export function planPrice(plan: Plan, interval: Interval) {
  return interval === "yearly" ? plan.priceYearly : interval === "lifetime" ? plan.priceLifetime : plan.priceMonthly;
}

export function toCents(amount: number) {
  return Math.round(amount * 100);
}
