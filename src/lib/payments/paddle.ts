/** Paddle Billing gateway. Config keys: apiKey, clientToken, webhookSecret. Env: PADDLE_API_KEY, PADDLE_CLIENT_TOKEN, PADDLE_WEBHOOK_SECRET. Mode sandbox|live. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, toCents, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config, mode } = await gatewayConfig("paddle");
  const key = cfg(config, "apiKey", "PADDLE_API_KEY");
  if (!key) throw new GatewayError("Paddle is not configured: missing API key");
  const url = mode === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(url + path, { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new GatewayError(`Paddle ${path} failed: ${str(obj(d.error).detail || r.status)}`);
    return obj(d.data);
  };
  return { api, config, mode };
}

export async function syncPlansWithPaddle() {
  const { api } = await base();
  const plans = await db.plan.findMany({ where: { isFree: false } });
  let synced = 0;
  for (const plan of plans) {
    const product = await api("POST", "/products", { name: plan.name, description: plan.description || undefined, tax_category: "saas" });
    const make = async (existing: string | null, amount: number, interval: "month" | "year") => {
      if (amount <= 0) return null;
      if (existing) {
        const p = await api("GET", `/prices/${existing}`).catch(() => null);
        if (p && num(obj(p.unit_price).amount) === toCents(amount)) return existing;
      }
      const created = await api("POST", "/prices", { description: `${plan.name} ${interval}ly`, product_id: str(product.id), unit_price: { amount: String(toCents(amount)), currency_code: plan.currency || "USD" }, billing_cycle: { interval, frequency: 1 }, custom_data: { planId: plan.id } });
      return str(created.id);
    };
    const paddlePriceMonthly = await make(plan.paddlePriceMonthly, plan.priceMonthly, "month");
    const paddlePriceYearly = await make(plan.paddlePriceYearly, plan.priceYearly, "year");
    await db.plan.update({ where: { id: plan.id }, data: { paddlePriceMonthly, paddlePriceYearly } });
    synced++;
  }
  return { synced };
}

export const paddleGateway: Gateway = {
  slug: "paddle",
  name: "Paddle",
  supportsSubscriptions: true,
  configKeys: ["apiKey", "clientToken", "webhookSecret"],
  async createCheckout(p) {
    const { api, config, mode } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const currency = p.currency;
    let items: Record<string, unknown>[];
    if (p.interval === "lifetime" || p.discount > 0) {
      items = [{ quantity: 1, price: { description: `${p.plan.name} plan (${p.interval})`, name: `${p.plan.name} (${p.interval})`, unit_price: { amount: String(toCents(p.amount - p.tax)), currency_code: currency }, product: { name: p.plan.name, tax_category: "saas" }, ...(p.interval !== "lifetime" ? { billing_cycle: { interval: p.interval === "yearly" ? "year" : "month", frequency: 1 } } : {}) } }];
    } else {
      let priceId = p.interval === "yearly" ? p.plan.paddlePriceYearly : p.plan.paddlePriceMonthly;
      if (!priceId) {
        await syncPlansWithPaddle();
        const fresh = await db.plan.findUnique({ where: { id: p.plan.id } });
        priceId = p.interval === "yearly" ? fresh?.paddlePriceYearly ?? null : fresh?.paddlePriceMonthly ?? null;
      }
      if (!priceId) throw new GatewayError("No Paddle price for this plan");
      items = [{ price_id: priceId, quantity: 1 }];
    }
    const tx = await api("POST", "/transactions", { items, custom_data: { ref }, customer: { email: p.user.email }, checkout: { url: p.successUrl } });
    const checkoutUrl = str(obj(tx.checkout).url);
    if (checkoutUrl) return { url: checkoutUrl };
    return { clientSecret: str(tx.id), publicKey: cfg(config, "clientToken", "PADDLE_CLIENT_TOKEN"), extra: { environment: mode === "live" ? "production" : "sandbox" } };
  },
  async handleWebhook(req) {
    const { config } = await base();
    const { raw, data } = await readBody(req);
    const secret = cfg(config, "webhookSecret", "PADDLE_WEBHOOK_SECRET");
    if (secret) {
      const sig = req.headers.get("paddle-signature") ?? "";
      const ts = /ts=(\d+)/.exec(sig)?.[1];
      const h1 = /h1=([a-f0-9]+)/.exec(sig)?.[1];
      const expected = crypto.createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex");
      if (!ts || !h1 || h1 !== expected) throw new GatewayError("Invalid Paddle signature");
    }
    const type = str(data.event_type);
    const d = obj(data.data);
    const out: PaymentEvent[] = [];
    if (type === "transaction.completed" || type === "transaction.paid") {
      const ref = decodeRef(str(obj(d.custom_data).ref));
      const subId = str(d.subscription_id);
      if (ref) {
        const existing = await db.payment.findFirst({ where: { gateway: "paddle", status: "completed", userId: ref.userId } });
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(obj(d.details && obj(d.details).totals).total) / 100, currency: str(d.currency_code) || "USD", transactionId: str(d.id), gatewaySubId: subId || undefined });
      }
    } else if (type === "subscription.canceled" || type === "subscription.past_due" || type === "subscription.paused") {
      out.push({ type: "subscription_cancelled", gatewaySubId: str(d.id) });
    } else if (type === "adjustment.updated" && str(d.action) === "refund" && str(d.status) === "approved") {
      out.push({ type: "refund", transactionId: str(d.transaction_id) });
    } else out.push({ type: "ignored", note: type });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    await api("POST", `/subscriptions/${sub.gatewaySubId}/cancel`, { effective_from: "next_billing_period" });
  },
  syncPlans: syncPlansWithPaddle,
};
