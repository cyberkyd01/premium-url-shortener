import type { Payment } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { notify, notifyAdmins } from "@/lib/notify";
import { creditAffiliate } from "@/lib/affiliate";
import { formatMoney, json } from "@/lib/utils";
import { computeTotals } from "./pricing";
import type { BillingInfo, Interval } from "./types";

export interface ApplyPaymentInput {
  userId: string;
  planId: string;
  interval: Interval;
  gateway: string;
  amount: number;
  currency?: string;
  transactionId?: string | null;
  couponCode?: string | null;
  /** When the checkout created a pending Payment row, pass its id to complete it instead of creating a new one. */
  paymentId?: string | null;
  gatewaySubId?: string | null;
  currentPeriodEnd?: Date | null;
  billingInfo?: BillingInfo | null;
  tax?: number | null;
  discount?: number | null;
  /** Skip email/notifications (e.g. admin manual). */
  silent?: boolean;
}

/** Computes the next expiry for an interval starting from `from` (extends an active plan instead of resetting). */
export function nextExpiry(interval: Interval, from?: Date | null, samePlan = false) {
  const base = samePlan && from && from > new Date() ? new Date(from) : new Date();
  if (interval === "lifetime") { const d = new Date(base); d.setFullYear(d.getFullYear() + 100); return d; }
  const d = new Date(base);
  if (interval === "yearly") d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function nextInvoiceNumber() {
  const s = await getSettings();
  const prefix = (s["payments.invoicePrefix"] || "INV").replace(/-+$/, "");
  const count = await db.payment.count({ where: { invoiceNumber: { not: null } } });
  let n = count + 1;
  // ensure uniqueness
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}-${String(n).padStart(6, "0")}`;
    const exists = await db.payment.findUnique({ where: { invoiceNumber: candidate } });
    if (!exists) return candidate;
    n++;
  }
  return `${prefix}-${Date.now()}`;
}

/** Idempotent: if a completed payment with the same gateway+transactionId exists, it is returned untouched. */
export async function applyPayment(input: ApplyPaymentInput): Promise<Payment> {
  const { userId, planId, interval, gateway } = input;
  if (input.transactionId) {
    const dup = await db.payment.findFirst({ where: { gateway, transactionId: input.transactionId, status: "completed" } });
    if (dup) return dup;
  }
  const [user, plan] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!user) throw new Error("User not found for payment");
  if (!plan) throw new Error("Plan not found for payment");

  const existing = input.paymentId ? await db.payment.findUnique({ where: { id: input.paymentId } }) : null;
  const billing: BillingInfo = input.billingInfo ?? json<BillingInfo>(existing?.billingInfo, {});
  const coupon = input.couponCode ? await db.coupon.findUnique({ where: { code: input.couponCode } }) : null;

  let tax = input.tax ?? existing?.tax ?? null;
  let discount = input.discount ?? existing?.discount ?? null;
  if (tax === null || discount === null) {
    const totals = await computeTotals(plan, interval, coupon, billing.country, billing.state);
    if (tax === null) tax = totals.tax;
    if (discount === null) discount = totals.discount;
  }
  const currency = input.currency || existing?.currency || plan.currency || "USD";
  const invoiceNumber = existing?.invoiceNumber ?? (await nextInvoiceNumber());
  const data = {
    userId, planId, gateway, interval, amount: input.amount, tax, discount, currency, status: "completed",
    transactionId: input.transactionId ?? existing?.transactionId ?? null, couponCode: input.couponCode ?? existing?.couponCode ?? null,
    invoiceNumber, billingInfo: JSON.stringify(billing),
  };
  const payment = existing
    ? await db.payment.update({ where: { id: existing.id }, data })
    : await db.payment.create({ data });

  // Plan assignment
  const samePlan = user.planId === planId;
  const planExpires = input.currentPeriodEnd ?? nextExpiry(interval, user.planExpires, samePlan);
  await db.user.update({ where: { id: userId }, data: { planId, planExpires, planTrialEnds: null } });

  // Subscription upsert (one active per user)
  const sub = await db.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  const subData = { planId, gateway, interval, status: "active", currentPeriodEnd: planExpires, gatewaySubId: input.gatewaySubId ?? (sub?.gateway === gateway ? sub.gatewaySubId : null), cancelAt: null };
  if (sub) await db.subscription.update({ where: { id: sub.id }, data: subData });
  else await db.subscription.create({ data: { userId, ...subData } });

  // Coupon usage: count once per user (first completion of a pending payment, or a renewal without a prior redemption)
  if (coupon) {
    const redeemed = await db.couponRedemption.findFirst({ where: { couponId: coupon.id, userId } });
    if (!redeemed) {
      await db.$transaction([
        db.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } }),
        db.couponRedemption.create({ data: { couponId: coupon.id, userId } }),
      ]).catch(() => {});
    }
  }

  if (!input.silent) {
    const money = formatMoney(payment.amount, currency);
    await sendTemplate("payment-received", user.email, { name: user.name ?? user.username, amount: money, plan: plan.name, invoice: invoiceNumber, interval }, user.language).catch(() => {});
    await notify(userId, "Payment received", `Your ${plan.name} plan (${interval}) is now active. Invoice ${invoiceNumber}.`, { link: "/dashboard/billing", type: "success" }).catch(() => {});
    await notifyAdmins("New payment", `${user.username} paid ${money} for ${plan.name} (${interval}) via ${gateway}.`, "/admin/payments").catch(() => {});
  }
  await creditAffiliate(payment).catch((e) => console.error("[affiliate]", e));
  return payment;
}

/** Marks the user's subscription cancelled (called from gateway webhooks or dashboard). Plan stays active until expiry. */
export async function markSubscriptionCancelled(where: { gatewaySubId?: string | null; userId?: string; gateway?: string }) {
  const sub = await db.subscription.findFirst({ where: { ...(where.gatewaySubId ? { gatewaySubId: where.gatewaySubId } : {}), ...(where.userId ? { userId: where.userId } : {}), ...(where.gateway ? { gateway: where.gateway } : {}) }, orderBy: { createdAt: "desc" } });
  if (!sub) return null;
  return db.subscription.update({ where: { id: sub.id }, data: { status: "cancelled", cancelAt: sub.currentPeriodEnd ?? new Date() } });
}

/** Marks a payment refunded and downgrades the user to the free plan when the refunded payment was the active one. */
export async function markRefunded(gateway: string, transactionId: string) {
  const p = await db.payment.findFirst({ where: { gateway, transactionId } });
  if (!p) return null;
  await db.payment.update({ where: { id: p.id }, data: { status: "refunded" } });
  const user = await db.user.findUnique({ where: { id: p.userId } });
  if (user && user.planId === p.planId) {
    const free = await db.plan.findFirst({ where: { isFree: true } });
    await db.user.update({ where: { id: user.id }, data: { planId: free?.id ?? null, planExpires: null } });
    await db.subscription.updateMany({ where: { userId: user.id }, data: { status: "cancelled" } });
  }
  return p;
}

/** Grants a plan for free (vouchers, trials, admin). */
export async function grantPlan(userId: string, planId: string, days: number | null, opts: { trial?: boolean } = {}) {
  const expires = days === null ? nextExpiry("lifetime") : new Date(Date.now() + days * 86400_000);
  await db.user.update({ where: { id: userId }, data: { planId, planExpires: expires, planTrialEnds: opts.trial ? expires : null } });
  const sub = await db.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  const data = { planId, gateway: opts.trial ? "trial" : "voucher", interval: "monthly", status: opts.trial ? "trialing" : "active", currentPeriodEnd: expires, gatewaySubId: null, cancelAt: null };
  if (sub) await db.subscription.update({ where: { id: sub.id }, data }); else await db.subscription.create({ data: { userId, ...data } });
  return expires;
}
