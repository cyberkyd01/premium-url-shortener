"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { validateCoupon, grantPlan, cancelSubscriptionEverywhere, resumeSubscriptionEverywhere } from "@/lib/payments";
import { invoiceNumber } from "@/lib/utils";
import { notify } from "@/lib/notify";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/billing";

export async function cancelSubscription(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const sub = await db.subscription.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!sub) return { error: "Subscription not found" };
  if (sub.status === "cancelled") return { error: "Already cancelled" };
  try { await cancelSubscriptionEverywhere(sub); } catch (e) { return { error: e instanceof Error ? e.message : "Could not cancel with the payment provider" }; }
  await notify(u.id, "Subscription cancelled", "Your subscription will not renew. Premium features stay active until the end of the current period.", { link: P });
  revalidatePath(P);
  return { ok: true, message: "Subscription cancelled. Your plan stays active until the end of the paid period." };
}

export async function resumeSubscription(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const sub = await db.subscription.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!sub) return { error: "Subscription not found" };
  try {
    const r = await resumeSubscriptionEverywhere(sub);
    if (!r.ok) return { error: r.error };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not resume" }; }
  revalidatePath(P);
  return { ok: true, message: "Subscription resumed" };
}

/** Redeems a voucher (free plan period) or redirects to checkout with a discount coupon pre-filled. */
export async function redeemCode(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const code = String(fd.get("code") ?? "").trim();
  if (!code) return { error: "Enter a code" };
  const coupon = await db.coupon.findUnique({ where: { code }, include: { plan: true } });
  if (!coupon) return { error: "Invalid code" };
  const planId = coupon.planId ?? String(fd.get("planId") ?? "");
  if (!planId) return { error: "This coupon applies to any plan: choose a plan below and enter the code at checkout." };
  const check = await validateCoupon(code, planId, u.id);
  if (!check.ok) return { error: check.error };
  if (!coupon.isVoucher) redirect(`/checkout/${planId}?coupon=${encodeURIComponent(code)}`);
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "Plan not found" };
  await grantPlan(u.id, plan.id, coupon.voucherDays > 0 ? coupon.voucherDays : null);
  await db.$transaction([
    db.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } }),
    db.couponRedemption.create({ data: { couponId: coupon.id, userId: u.id } }),
    db.payment.create({ data: { userId: u.id, planId: plan.id, gateway: "voucher", amount: 0, currency: plan.currency, interval: "monthly", status: "completed", couponCode: coupon.code, invoiceNumber: invoiceNumber() } }),
  ]);
  revalidatePath("/dashboard");
  return { ok: true, message: `Voucher redeemed: ${plan.name} is active${coupon.voucherDays > 0 ? ` for ${coupon.voucherDays} days` : ""}.` };
}
