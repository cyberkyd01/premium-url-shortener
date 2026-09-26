/** Paystack gateway. Config keys: secretKey, publicKey. Env: PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY. Webhook verified with HMAC-SHA512 of body using secret key. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, toCents, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config } = await gatewayConfig("paystack");
  const key = cfg(config, "secretKey", "PAYSTACK_SECRET_KEY");
  if (!key) throw new GatewayError("Paystack is not configured: missing secret key");
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch("https://api.paystack.co" + path, { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok || d.status === false) throw new GatewayError(`Paystack ${path} failed: ${str(d.message || r.status)}`);
    return obj(d.data);
  };
  return { api, key, config };
}

export async function syncPlansWithPaystack() {
  const { api } = await base();
  const plans = await db.plan.findMany({ where: { isFree: false } });
  let synced = 0;
  for (const plan of plans) {
    const make = async (existing: string | null, amount: number, interval: "monthly" | "annually") => {
      if (amount <= 0) return null;
      if (existing) {
        await api("PUT", `/plan/${existing}`, { name: `${plan.name} ${interval}`, amount: toCents(amount) }).catch(() => null);
        return existing;
      }
      const created = await api("POST", "/plan", { name: `${plan.name} ${interval}`, interval, amount: toCents(amount), currency: plan.currency || "NGN" });
      return str(created.plan_code);
    };
    const paystackPlanMonthly = await make(plan.paystackPlanMonthly, plan.priceMonthly, "monthly");
    const paystackPlanYearly = await make(plan.paystackPlanYearly, plan.priceYearly, "annually");
    await db.plan.update({ where: { id: plan.id }, data: { paystackPlanMonthly, paystackPlanYearly } });
    synced++;
  }
  return { synced };
}

export const paystackGateway: Gateway = {
  slug: "paystack",
  name: "Paystack",
  supportsSubscriptions: true,
  configKeys: ["secretKey", "publicKey"],
  async createCheckout(p) {
    const { api } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const body: Record<string, unknown> = { email: p.user.email, amount: toCents(p.amount), currency: p.currency, callback_url: p.successUrl, reference: p.paymentId, metadata: { ref, custom_fields: [{ display_name: "Plan", variable_name: "plan", value: `${p.plan.name} (${p.interval})` }] } };
    if (p.interval !== "lifetime" && p.discount === 0 && p.tax === 0) {
      let code = p.interval === "yearly" ? p.plan.paystackPlanYearly : p.plan.paystackPlanMonthly;
      if (!code) { await syncPlansWithPaystack(); const fresh = await db.plan.findUnique({ where: { id: p.plan.id } }); code = p.interval === "yearly" ? fresh?.paystackPlanYearly ?? null : fresh?.paystackPlanMonthly ?? null; }
      if (code) body.plan = code;
    }
    const tx = await api("POST", "/transaction/initialize", body);
    return { url: str(tx.authorization_url) };
  },
  async handleWebhook(req) {
    const { key } = await base();
    const { raw, data } = await readBody(req);
    const sig = req.headers.get("x-paystack-signature") ?? "";
    const expected = crypto.createHmac("sha512", key).update(raw).digest("hex");
    if (sig !== expected) throw new GatewayError("Invalid Paystack signature");
    const event = str(data.event);
    const d = obj(data.data);
    const out: PaymentEvent[] = [];
    if (event === "charge.success") {
      const meta = obj(d.metadata);
      const ref = decodeRef(str(meta.ref));
      const refId = str(d.reference);
      const pending = ref ? null : await db.payment.findFirst({ where: { id: refId, gateway: "paystack" } });
      const info = ref ?? (pending ? { paymentId: pending.id, userId: pending.userId, planId: pending.planId ?? "", interval: pending.interval as "monthly" | "yearly" | "lifetime", couponCode: pending.couponCode } : null);
      if (info) {
        const existing = await db.payment.findFirst({ where: { gateway: "paystack", status: "completed", userId: info.userId } });
        out.push({ type: "payment", ...info, paymentId: existing ? undefined : info.paymentId, couponCode: info.couponCode ?? undefined, amount: num(d.amount) / 100, currency: str(d.currency) || "NGN", transactionId: str(d.reference), gatewaySubId: str(obj(d.plan).plan_code) || undefined });
      }
    } else if (event === "subscription.disable" || event === "subscription.not_renew") {
      out.push({ type: "subscription_cancelled", gatewaySubId: str(d.subscription_code) || str(obj(d.plan).plan_code) });
    } else if (event === "refund.processed") {
      out.push({ type: "refund", transactionId: str(d.transaction_reference) });
    } else out.push({ type: "ignored", note: event });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    const list = await api("GET", `/subscription?plan=${sub.gatewaySubId}`).catch(() => null);
    const subs = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
    const user = await db.user.findUnique({ where: { id: sub.userId } });
    const mine = subs.find((s) => str(obj(s.customer).email) === user?.email) ?? null;
    if (mine) await api("POST", "/subscription/disable", { code: str(mine.subscription_code), token: str(mine.email_token) });
  },
  syncPlans: syncPlansWithPaystack,
};
