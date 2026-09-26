/** Razorpay gateway. Config keys: keyId, keySecret, webhookSecret. Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, toCents, type CheckoutResult, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config } = await gatewayConfig("razorpay");
  const id = cfg(config, "keyId", "RAZORPAY_KEY_ID");
  const secret = cfg(config, "keySecret", "RAZORPAY_KEY_SECRET");
  if (!id || !secret) throw new GatewayError("Razorpay is not configured: missing key id/secret");
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch("https://api.razorpay.com/v1" + path, { method, headers: { authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new GatewayError(`Razorpay ${path} failed: ${str(obj(d.error).description || r.status)}`);
    return d;
  };
  return { api, id, secret, config };
}

export const razorpayGateway: Gateway = {
  slug: "razorpay",
  name: "Razorpay",
  supportsSubscriptions: true,
  configKeys: ["keyId", "keySecret", "webhookSecret"],
  async createCheckout(p): Promise<CheckoutResult> {
    const { api, id } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    if (p.interval !== "lifetime") {
      const plan = await api("POST", "/plans", { period: p.interval === "yearly" ? "yearly" : "monthly", interval: 1, item: { name: `${p.plan.name} (${p.interval})`, amount: toCents(p.amount), currency: p.currency }, notes: { planId: p.plan.id } });
      const sub = await api("POST", "/subscriptions", { plan_id: str(plan.id), total_count: p.interval === "yearly" ? 10 : 120, customer_notify: 1, notes: { ref } });
      const short = str(sub.short_url);
      if (short) return { url: short };
      return { clientSecret: str(sub.id), publicKey: id, extra: { kind: "subscription", email: p.user.email, name: p.plan.name } };
    }
    const order = await api("POST", "/orders", { amount: toCents(p.amount), currency: p.currency, receipt: p.paymentId, notes: { ref } });
    // Standard checkout requires the JS widget; we return the order id for the client, and the callback goes through the webhook.
    return { clientSecret: str(order.id), publicKey: id, extra: { kind: "order", email: p.user.email, name: p.plan.name, amount: String(toCents(p.amount)), currency: p.currency, successUrl: p.successUrl } };
  },
  async handleWebhook(req) {
    const { config } = await base();
    const { raw, data } = await readBody(req);
    const secret = cfg(config, "webhookSecret", "RAZORPAY_WEBHOOK_SECRET");
    if (secret) {
      const sig = req.headers.get("x-razorpay-signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (sig !== expected) throw new GatewayError("Invalid Razorpay signature");
    }
    const event = str(data.event);
    const payload = obj(data.payload);
    const out: PaymentEvent[] = [];
    if (event === "payment.captured") {
      const pay = obj(obj(payload.payment).entity);
      let ref = decodeRef(str(obj(pay.notes).ref));
      const orderId = str(pay.order_id);
      if (!ref && orderId) {
        const { api } = await base();
        const order = await api("GET", `/orders/${orderId}`).catch(() => null);
        ref = decodeRef(str(obj(order?.notes).ref));
      }
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(pay.amount) / 100, currency: str(pay.currency) || "INR", transactionId: str(pay.id) });
    } else if (event === "subscription.charged") {
      const sub = obj(obj(payload.subscription).entity);
      const pay = obj(obj(payload.payment).entity);
      const ref = decodeRef(str(obj(sub.notes).ref));
      if (ref) {
        const existing = await db.payment.findFirst({ where: { gateway: "razorpay", status: "completed", userId: ref.userId } });
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(pay.amount) / 100, currency: str(pay.currency) || "INR", transactionId: str(pay.id), gatewaySubId: str(sub.id), currentPeriodEnd: sub.current_end ? new Date(num(sub.current_end) * 1000) : undefined });
      }
    } else if (event === "subscription.cancelled" || event === "subscription.halted") {
      out.push({ type: "subscription_cancelled", gatewaySubId: str(obj(obj(payload.subscription).entity).id) });
    } else if (event === "refund.processed") {
      out.push({ type: "refund", transactionId: str(obj(obj(payload.refund).entity).payment_id) });
    } else out.push({ type: "ignored", note: event });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    await api("POST", `/subscriptions/${sub.gatewaySubId}/cancel`, { cancel_at_cycle_end: 1 });
  },
  async refund(transactionId, amount) {
    const { api } = await base();
    await api("POST", `/payments/${transactionId}/refund`, amount ? { amount: toCents(amount) } : {});
  },
};
