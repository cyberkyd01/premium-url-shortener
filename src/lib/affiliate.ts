import type { Payment } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { notify } from "./notify";
import { formatMoney } from "./utils";

/** Credits an affiliate commission to the referrer of the paying user.
 *  settings: affiliate.enabled, affiliate.commission, affiliate.commissionType (percent|fixed), affiliate.frequency (first|recurring). */
export async function creditAffiliate(payment: Payment) {
  const s = await getSettings();
  if (s["affiliate.enabled"] !== "1") return null;
  if (payment.status !== "completed" || payment.amount <= 0) return null;
  const buyer = await db.user.findUnique({ where: { id: payment.userId }, select: { id: true, referredById: true, username: true } });
  if (!buyer?.referredById) return null;
  const referrer = await db.user.findUnique({ where: { id: buyer.referredById }, select: { id: true, status: true } });
  if (!referrer || referrer.status === 0 || referrer.id === buyer.id) return null;
  // avoid double credit for the same payment
  const dup = await db.affiliateEarning.findFirst({ where: { paymentId: payment.id } });
  if (dup) return dup;
  if ((s["affiliate.frequency"] || "first") === "first") {
    const prior = await db.affiliateEarning.findFirst({ where: { userId: referrer.id, referredId: buyer.id } });
    if (prior) return null;
  }
  const rate = parseFloat(s["affiliate.commission"] || "0");
  if (!rate || rate <= 0) return null;
  const base = payment.amount - payment.tax;
  const amount = Math.round(((s["affiliate.commissionType"] || "percent") === "percent" ? (base * rate) / 100 : rate) * 100) / 100;
  if (amount <= 0) return null;
  const [earning] = await db.$transaction([
    db.affiliateEarning.create({ data: { userId: referrer.id, referredId: buyer.id, paymentId: payment.id, amount, status: "approved" } }),
    db.user.update({ where: { id: referrer.id }, data: { affiliateBalance: { increment: amount } } }),
  ]);
  await notify(referrer.id, "New affiliate commission", `You earned ${formatMoney(amount, payment.currency)} from a referral purchase.`, { link: "/dashboard/affiliate", type: "success" }).catch(() => {});
  return earning;
}

/** Aggregated affiliate stats for the dashboard. */
export async function affiliateStats(userId: string) {
  const [referrals, earnings, payouts, user] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.affiliateEarning.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.affiliatePayout.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.user.findUnique({ where: { id: userId }, select: { affiliateBalance: true, affiliateCode: true, username: true } }),
  ]);
  const sum = (status: string) => earnings.filter((e) => e.status === status).reduce((a, e) => a + e.amount, 0);
  return { referrals, earnings, payouts, balance: user?.affiliateBalance ?? 0, code: user?.affiliateCode ?? "", username: user?.username ?? "", pending: sum("pending"), approved: sum("approved"), paid: sum("paid"), total: earnings.reduce((a, e) => a + e.amount, 0), requested: payouts.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0) };
}
