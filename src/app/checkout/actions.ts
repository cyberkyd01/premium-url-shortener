"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeTotals, validateCoupon, getGateway, grantPlan, GatewayError, INTERVALS, planPrice, type BillingInfo, type Interval, type Totals } from "@/lib/payments";
import { appUrl, invoiceNumber } from "@/lib/utils";
import { notify } from "@/lib/notify";
import type { ActionState } from "@/components/ui/form-state";

export interface Quote { totals: Totals; coupon: { code: string; isVoucher: boolean; voucherDays: number; description: string } | null; error?: string }

function asInterval(v: unknown, plan: { priceMonthly: number; priceYearly: number; priceLifetime: number }): Interval {
  const i = String(v ?? "monthly") as Interval;
  if (INTERVALS.includes(i) && planPrice(plan as never, i) > 0) return i;
  return plan.priceMonthly > 0 ? "monthly" : plan.priceYearly > 0 ? "yearly" : "lifetime";
}

/** Live price quote for the checkout page (interval, coupon, billing country). */
export async function quote(input: { planId: string; interval: string; coupon?: string; country?: string; state?: string }): Promise<Quote> {
  const u = await requireUser();
  const plan = await db.plan.findUnique({ where: { id: input.planId } });
  if (!plan) return { totals: { subtotal: 0, discount: 0, taxRate: 0, taxName: "", tax: 0, total: 0, currency: "USD" }, coupon: null, error: "Plan not found" };
  const interval = asInterval(input.interval, plan);
  let coupon = null;
  let error: string | undefined;
  if (input.coupon?.trim()) {
    const r = await validateCoupon(input.coupon, plan.id, u.id);
    if (r.ok) coupon = r.coupon; else error = r.error;
  }
  const totals = await computeTotals(plan, interval, coupon, input.country, input.state);
  return {
    totals, error,
    coupon: coupon ? { code: coupon.code, isVoucher: coupon.isVoucher, voucherDays: coupon.voucherDays, description: coupon.isVoucher ? `Voucher: ${plan.name} free for ${coupon.voucherDays} days` : coupon.type === "percent" ? `${coupon.amount}% off` : `${coupon.amount} off` } : null,
  };
}

/** Starts the checkout: creates a pending Payment, then redirects to the gateway (or returns client data / bank instructions). */
export async function startCheckout(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const s = await getSettings();
  if (s["payments.enabled"] !== "1") return { error: "Payments are disabled" };
  const plan = await db.plan.findUnique({ where: { id: String(fd.get("planId") ?? "") } });
  if (!plan || !plan.isPublic || plan.isFree) return { error: "This plan is not available" };
  const user = await db.user.findUnique({ where: { id: u.id } });
  if (!user) return { error: "User not found" };
  const interval = asInterval(fd.get("interval"), plan);
  const billing: BillingInfo = { name: String(fd.get("name") ?? "").trim(), email: user.email, address: String(fd.get("address") ?? "").trim(), city: String(fd.get("city") ?? "").trim(), zip: String(fd.get("zip") ?? "").trim(), country: String(fd.get("country") ?? "").trim().toUpperCase(), state: String(fd.get("state") ?? "").trim(), vat: String(fd.get("vat") ?? "").trim() };
  if (!billing.name) return { error: "Please enter your billing name" };
  if (!billing.country) return { error: "Please select your country" };
  const code = String(fd.get("coupon") ?? "").trim();
  let coupon = null;
  if (code) {
    const r = await validateCoupon(code, plan.id, u.id);
    if (!r.ok) return { error: r.error };
    coupon = r.coupon;
  }
  // Vouchers: grant the plan without payment
  if (coupon?.isVoucher) {
    await grantPlan(u.id, plan.id, coupon.voucherDays > 0 ? coupon.voucherDays : null);
    await db.$transaction([
      db.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } }),
      db.couponRedemption.create({ data: { couponId: coupon.id, userId: u.id } }),
      db.payment.create({ data: { userId: u.id, planId: plan.id, gateway: "voucher", amount: 0, currency: plan.currency, interval, status: "completed", couponCode: coupon.code, invoiceNumber: invoiceNumber(), billingInfo: JSON.stringify(billing) } }),
    ]);
    revalidatePath("/dashboard");
    redirect("/checkout/success?voucher=1");
  }
  const totals = await computeTotals(plan, interval, coupon, billing.country, billing.state);
  const gatewaySlug = String(fd.get("gateway") ?? "");
  const row = await db.paymentGateway.findFirst({ where: { slug: gatewaySlug, enabled: true } });
  const gateway = row ? getGateway(row.slug) : null;
  if (!gateway) return { error: "Please choose a payment method" };
  if (totals.total <= 0) {
    // 100% discount: activate directly
    const { applyPayment } = await import("@/lib/payments");
    await applyPayment({ userId: u.id, planId: plan.id, interval, gateway: "coupon", amount: 0, currency: totals.currency, couponCode: coupon?.code, billingInfo: billing, tax: 0, discount: totals.discount });
    revalidatePath("/dashboard");
    redirect("/checkout/success");
  }
  const pending = await db.payment.create({ data: { userId: u.id, planId: plan.id, gateway: gateway.slug, amount: totals.total, tax: totals.tax, discount: totals.discount, currency: totals.currency, interval, status: "pending", couponCode: coupon?.code ?? null, billingInfo: JSON.stringify(billing) } });
  let result;
  try {
    result = await gateway.createCheckout({ user, plan, interval, amount: totals.total, currency: totals.currency, coupon, taxRate: totals.taxRate, tax: totals.tax, discount: totals.discount, billing, successUrl: appUrl(`/checkout/success?payment=${pending.id}`), cancelUrl: appUrl(`/checkout/cancel?payment=${pending.id}`), paymentId: pending.id });
  } catch (e) {
    await db.payment.update({ where: { id: pending.id }, data: { status: "failed" } }).catch(() => {});
    return { error: e instanceof GatewayError || e instanceof Error ? e.message : "Could not start the checkout" };
  }
  if ("url" in result) redirect(result.url);
  if ("pending" in result) return { ok: true, message: result.message, data: { pending: true, paymentId: pending.id } };
  return { ok: true, data: { clientSecret: result.clientSecret, publicKey: result.publicKey ?? "", extra: result.extra ?? {}, gateway: gateway.slug, paymentId: pending.id } };
}

/** Starts a free trial when the plan offers one and the user never paid or trialed before. */
export async function startTrial(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const plan = await db.plan.findUnique({ where: { id: String(fd.get("planId") ?? "") } });
  if (!plan || plan.trialDays <= 0 || plan.isFree || !plan.isPublic) return { error: "This plan has no trial" };
  const eligible = await trialEligible(u.id);
  if (!eligible) return { error: "You are not eligible for a trial" };
  await grantPlan(u.id, plan.id, plan.trialDays, { trial: true });
  await notify(u.id, "Trial started", `Your ${plan.trialDays}-day ${plan.name} trial is active.`, { link: "/dashboard/billing", type: "success" });
  revalidatePath("/dashboard");
  redirect("/checkout/success?trial=1");
}

export async function trialEligible(userId: string) {
  const [paid, trialed, user] = await Promise.all([
    db.payment.count({ where: { userId, status: "completed" } }),
    db.subscription.count({ where: { userId, gateway: "trial" } }),
    db.user.findUnique({ where: { id: userId }, select: { planTrialEnds: true } }),
  ]);
  return paid === 0 && trialed === 0 && !user?.planTrialEnds;
}
