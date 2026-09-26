"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, num, bool } from "@/lib/admin/query";
import { invoiceNumber } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

type Interval = "monthly" | "yearly" | "lifetime";
const intervalOf = (v: string): Interval => (v === "yearly" || v === "lifetime" ? v : "monthly");

function expiryFor(interval: Interval, from: Date | null) {
  const base = from && from > new Date() ? new Date(from) : new Date();
  if (interval === "lifetime") base.setFullYear(base.getFullYear() + 100);
  else if (interval === "yearly") base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base;
}

/** Completes a payment: prefers the payments module's applyPayment (emails, subscription, affiliate); falls back to a direct update. */
async function complete(paymentId: string, silent: boolean) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, include: { user: true } });
  if (!p) throw new Error("Payment not found.");
  if (!p.planId) throw new Error("Payment has no plan.");
  try {
    const { applyPayment } = await import("@/lib/payments");
    await applyPayment({ userId: p.userId, planId: p.planId, interval: intervalOf(p.interval), gateway: p.gateway, amount: p.amount, currency: p.currency, transactionId: p.transactionId, couponCode: p.couponCode, paymentId: p.id, tax: p.tax, discount: p.discount, silent });
  } catch (e) {
    if (e instanceof Error && !/Cannot find module|payments/.test(e.message)) throw e;
    await db.payment.update({ where: { id: p.id }, data: { status: "completed", invoiceNumber: p.invoiceNumber ?? invoiceNumber() } });
    const samePlan = p.user.planId === p.planId;
    await db.user.update({ where: { id: p.userId }, data: { planId: p.planId, planExpires: expiryFor(intervalOf(p.interval), samePlan ? p.user.planExpires : null), planTrialEnds: null } });
  }
}

export async function paymentQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("payments.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const p = await db.payment.findUnique({ where: { id } });
    if (!p) return { ok: false, error: "Payment not found." };
    if (op === "complete") { if (p.status === "completed") return { ok: false, error: "Already completed." }; await complete(id, bool(fd, "silent")); }
    else if (op === "refund") {
      let remote = "";
      if (bool(fd, "remote") && p.transactionId) {
        try { const { getGateway } = await import("@/lib/payments"); const g = getGateway(p.gateway); if (g?.refund) { await g.refund(p.transactionId); remote = " Refund issued at the provider."; } }
        catch (e) { return { ok: false, error: `Provider refund failed: ${e instanceof Error ? e.message : "unknown"}` }; }
      }
      await db.payment.update({ where: { id }, data: { status: "refunded" } });
      const user = await db.user.findUnique({ where: { id: p.userId } });
      if (user && user.planId === p.planId) {
        const free = await db.plan.findFirst({ where: { isFree: true } });
        await db.user.update({ where: { id: user.id }, data: { planId: free?.id ?? null, planExpires: null } });
        await db.subscription.updateMany({ where: { userId: user.id, status: { in: ["active", "trialing"] } }, data: { status: "cancelled" } });
      }
      revalidatePath("/admin/payments"); revalidatePath(`/admin/payments/${id}`);
      return { ok: true, message: "Payment refunded and user downgraded." + remote };
    }
    else if (op === "fail") await db.payment.update({ where: { id }, data: { status: "failed" } });
    else if (op === "delete") { await db.payment.delete({ where: { id } }); revalidatePath("/admin/payments"); redirect("/admin/payments"); }
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/payments"); revalidatePath(`/admin/payments/${id}`);
    return { ok: true, message: "Done." };
  });
}

export async function addManualPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("payments.manage", async () => {
    const login = str(fd, "user");
    const user = await db.user.findFirst({ where: { OR: [{ username: login }, { email: login.toLowerCase() }] } });
    if (!user) return { ok: false, error: "User not found." };
    const planId = str(fd, "planId");
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) return { ok: false, error: "Plan not found." };
    const interval = intervalOf(str(fd, "interval"));
    const amount = num(fd, "amount", interval === "yearly" ? plan.priceYearly : interval === "lifetime" ? plan.priceLifetime : plan.priceMonthly);
    const payment = await db.payment.create({ data: { userId: user.id, planId, gateway: str(fd, "gateway") || "manual", transactionId: optStr(fd, "transactionId"), amount, currency: str(fd, "currency") || plan.currency, interval, status: "pending", invoiceNumber: invoiceNumber() } });
    if (bool(fd, "complete")) await complete(payment.id, !bool(fd, "notify"));
    revalidatePath("/admin/payments");
    redirect(`/admin/payments/${payment.id}`);
  });
}

export async function cancelSubscription(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("payments.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const sub = await db.subscription.findUnique({ where: { id } });
    if (!sub) return { ok: false, error: "Subscription not found." };
    if (op === "delete") { await db.subscription.delete({ where: { id } }); revalidatePath("/admin/subscriptions"); return { ok: true, message: "Deleted." }; }
    let note = "";
    if (bool(fd, "remote") && sub.gatewaySubId) {
      try { const { cancelSubscriptionEverywhere } = await import("@/lib/payments"); await cancelSubscriptionEverywhere(sub); note = " Cancelled at the provider."; }
      catch (e) { return { ok: false, error: `Provider cancellation failed: ${e instanceof Error ? e.message : "unknown"}` }; }
    }
    await db.subscription.update({ where: { id }, data: { status: "cancelled", cancelAt: sub.currentPeriodEnd ?? new Date() } });
    revalidatePath("/admin/subscriptions");
    return { ok: true, message: "Subscription cancelled; the plan stays active until the period ends." + note };
  });
}
