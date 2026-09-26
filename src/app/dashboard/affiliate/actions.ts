"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { notifyAdmins } from "@/lib/notify";
import { formatMoney, randomToken } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/affiliate";

export async function requestPayout(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const s = await getSettings();
  if (s["affiliate.enabled"] !== "1") return { error: "The affiliate program is disabled" };
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  const min = parseFloat(s["affiliate.minPayout"] || "0");
  const pending = await db.affiliatePayout.aggregate({ where: { userId: u.id, status: "pending" }, _sum: { amount: true } });
  const available = me.affiliateBalance - (pending._sum.amount ?? 0);
  const amount = Math.round(parseFloat(String(fd.get("amount") ?? "0")) * 100) / 100;
  const method = String(fd.get("method") ?? "paypal") === "bank" ? "bank" : "paypal";
  const details = String(fd.get("details") ?? "").trim().slice(0, 1000);
  if (!details) return { error: method === "paypal" ? "Enter your PayPal email" : "Enter your bank details" };
  if (method === "paypal" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details)) return { error: "Enter a valid PayPal email" };
  if (!amount || amount <= 0) return { error: "Enter an amount" };
  if (amount < min) return { error: `Minimum payout is ${formatMoney(min, s["payments.currency"] || "USD")}` };
  if (amount > available) return { error: `You can request up to ${formatMoney(Math.max(0, available), s["payments.currency"] || "USD")}` };
  await db.affiliatePayout.create({ data: { userId: u.id, amount, method, details } });
  await notifyAdmins("Affiliate payout requested", `${u.username} requested ${formatMoney(amount, s["payments.currency"] || "USD")} via ${method}.`, "/admin/affiliates");
  revalidatePath(P);
  return { ok: true, message: "Payout requested. You will be notified once it is processed." };
}

/** Generates an affiliate code for older accounts that have none. */
export async function ensureAffiliateCode() {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id }, select: { affiliateCode: true } });
  if (me?.affiliateCode) return me.affiliateCode;
  let code = randomToken(4);
  while (await db.user.findUnique({ where: { affiliateCode: code } })) code = randomToken(4);
  await db.user.update({ where: { id: u.id }, data: { affiliateCode: code } });
  return code;
}
