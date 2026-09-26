import type { Coupon, Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { planPrice, type Interval } from "./types";

export type CouponCheck = { ok: true; coupon: Coupon } | { ok: false; error: string };

/** Validates a coupon code for a plan (active, not expired, uses left, plan match). */
export async function validateCoupon(code: string, planId: string, userId?: string): Promise<CouponCheck> {
  const c = await db.coupon.findFirst({ where: { code: { equals: code.trim() } } });
  if (!c || !c.active) return { ok: false, error: "Invalid coupon code" };
  if (c.expiresAt && c.expiresAt < new Date()) return { ok: false, error: "This coupon has expired" };
  if (c.maxUses !== -1 && c.uses >= c.maxUses) return { ok: false, error: "This coupon has reached its usage limit" };
  if (c.planId && c.planId !== planId) return { ok: false, error: "This coupon is not valid for the selected plan" };
  if (userId) {
    const used = await db.couponRedemption.findFirst({ where: { couponId: c.id, userId } });
    if (used) return { ok: false, error: "You have already redeemed this coupon" };
  }
  return { ok: true, coupon: c };
}

/** Finds the tax rate (percentage) for a billing country/state when taxes are enabled. */
export async function taxRateFor(country?: string | null, state?: string | null) {
  const s = await getSettings();
  if (s["payments.taxEnabled"] !== "1") return { rate: 0, name: "" };
  const rates = await db.taxRate.findMany({ where: { active: true } });
  const cc = (country || "").toUpperCase();
  const st = (state || "").toUpperCase();
  const exact = rates.find((r) => r.country.toUpperCase() === cc && r.state && r.state.toUpperCase() === st);
  const byCountry = rates.find((r) => r.country.toUpperCase() === cc && !r.state);
  const global = rates.find((r) => r.country === "*");
  const hit = exact ?? byCountry ?? global;
  return { rate: hit?.rate ?? 0, name: hit?.name ?? "" };
}

export interface Totals { subtotal: number; discount: number; taxRate: number; taxName: string; tax: number; total: number; currency: string }

/** Computes subtotal/discount/tax/total for a plan + interval + optional coupon + billing country. */
export async function computeTotals(plan: Plan, interval: Interval, coupon?: Coupon | null, country?: string | null, state?: string | null): Promise<Totals> {
  const s = await getSettings();
  const subtotal = round(planPrice(plan, interval));
  let discount = 0;
  if (coupon && !coupon.isVoucher) {
    discount = coupon.type === "percent" ? (subtotal * coupon.amount) / 100 : coupon.amount;
    discount = Math.min(round(discount), subtotal);
  }
  const { rate, name } = await taxRateFor(country, state);
  const taxable = subtotal - discount;
  const tax = round((taxable * rate) / 100);
  return { subtotal, discount, taxRate: rate, taxName: name, tax, total: round(taxable + tax), currency: plan.currency || s["payments.currency"] || "USD" };
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}
