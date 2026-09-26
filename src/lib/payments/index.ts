/** Payment gateway registry. Each gateway implements the common `Gateway` interface (see ./types.ts).
 *  Credentials live in PaymentGateway.config (JSON) with env fallbacks documented at the top of each gateway file. */
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { json } from "@/lib/utils";
import { stripeGateway, syncPlansWithStripe } from "./stripe";
import { paypalGateway, syncPlansWithPayPal } from "./paypal";
import { paddleGateway, syncPlansWithPaddle } from "./paddle";
import { paddleClassicGateway } from "./paddle-classic";
import { paystackGateway, syncPlansWithPaystack } from "./paystack";
import { razorpayGateway } from "./razorpay";
import { mollieGateway } from "./mollie";
import { coinpaymentsGateway } from "./coinpayments";
import { cryptocomGateway } from "./cryptocom";
import { midtransGateway } from "./midtrans";
import { lemonsqueezyGateway } from "./lemonsqueezy";
import { iyzicoGateway } from "./iyzico";
import { bankGateway } from "./bank";
import { mercadopagoGateway } from "./mercadopago";
import type { Gateway } from "./types";

export * from "./types";
export { applyPayment, markSubscriptionCancelled, markRefunded, grantPlan, nextExpiry, nextInvoiceNumber } from "./apply";
export { computeTotals, validateCoupon, taxRateFor } from "./pricing";
export type { Totals, CouponCheck } from "./pricing";
export { gatewayConfig } from "./config";
export { syncPlansWithStripe, syncPlansWithPayPal, syncPlansWithPaddle, syncPlansWithPaystack };

export const GATEWAYS: Gateway[] = [
  stripeGateway, paypalGateway, paddleGateway, paddleClassicGateway, paystackGateway, razorpayGateway, mollieGateway,
  coinpaymentsGateway, cryptocomGateway, midtransGateway, lemonsqueezyGateway, iyzicoGateway, mercadopagoGateway, bankGateway,
];

export function getGateway(slug: string): Gateway | null {
  return GATEWAYS.find((g) => g.slug === slug) ?? null;
}

/** Gateway rows enabled by the admin, joined with their implementations. */
export async function enabledGateways() {
  const rows = await db.paymentGateway.findMany({ where: { enabled: true } });
  return rows.map((r) => ({ row: r, gateway: getGateway(r.slug) })).filter((x): x is { row: typeof x.row; gateway: Gateway } => !!x.gateway);
}

/** Public (non-secret) config a checkout page may need, e.g. publishable keys. */
export async function gatewayPublicConfig(slug: string) {
  const row = await db.paymentGateway.findUnique({ where: { slug } });
  const c = json<Record<string, string>>(row?.config, {});
  return { publishableKey: c.publishableKey ?? c.publicKey ?? c.clientToken ?? c.keyId ?? c.clientKey ?? "", mode: row?.mode ?? "sandbox" };
}

/** Ensures a PaymentGateway row exists for every implemented gateway (admin settings page helper). */
export async function ensureGatewayRows() {
  for (const g of GATEWAYS) {
    await db.paymentGateway.upsert({ where: { slug: g.slug }, update: { name: g.name }, create: { slug: g.slug, name: g.name, enabled: false } });
  }
}

/** Resumes a cancelled-at-period-end subscription when the provider supports it. */
export async function resumeSubscriptionEverywhere(sub: Subscription) {
  const g = getGateway(sub.gateway);
  if (!g?.resumeSubscription) return { ok: false as const, error: "This payment method does not support resuming. Please subscribe again from the plans list." };
  if (sub.gatewaySubId) await g.resumeSubscription(sub);
  await db.subscription.update({ where: { id: sub.id }, data: { status: "active", cancelAt: null } });
  return { ok: true as const };
}

/** Cancels a subscription with its provider and marks it cancelled locally. */
export async function cancelSubscriptionEverywhere(sub: Subscription) {
  const g = getGateway(sub.gateway);
  if (g && sub.gatewaySubId) await g.cancelSubscription(sub);
  return db.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", cancelAt: sub.currentPeriodEnd ?? new Date() } });
}
