/** Crypto.com Pay gateway (Payments API). Config keys: secretKey, publishableKey, webhookSecret. Env: CRYPTOCOM_SECRET_KEY, CRYPTOCOM_PUBLISHABLE_KEY, CRYPTOCOM_WEBHOOK_SECRET. One-time payments only. */
import crypto from "crypto";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, toCents, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config } = await gatewayConfig("cryptocom");
  const key = cfg(config, "secretKey", "CRYPTOCOM_SECRET_KEY");
  if (!key) throw new GatewayError("Crypto.com Pay is not configured: missing secret key");
  return { key, config };
}

export const cryptocomGateway: Gateway = {
  slug: "cryptocom",
  name: "Crypto.com Pay",
  supportsSubscriptions: false,
  configKeys: ["secretKey", "publishableKey", "webhookSecret"],
  async createCheckout(p) {
    const { key } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const r = await fetch("https://pay.crypto.com/api/payments", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ amount: toCents(p.amount), currency: p.currency, description: `${p.plan.name} plan (${p.interval})`, order_id: p.paymentId, metadata: { ref }, return_url: p.successUrl, cancel_url: p.cancelUrl }) });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new GatewayError("Crypto.com Pay error: " + str(obj(d.error).message || r.status));
    const url = str(d.payment_url);
    if (!url) throw new GatewayError("Crypto.com Pay did not return a payment URL");
    return { url };
  },
  async handleWebhook(req) {
    const { config } = await base();
    const { raw, data } = await readBody(req);
    const secret = cfg(config, "webhookSecret", "CRYPTOCOM_WEBHOOK_SECRET");
    if (secret) {
      const header = req.headers.get("pay-signature") ?? "";
      const t = /t=(\d+)/.exec(header)?.[1];
      const v1 = /v1=([a-f0-9]+)/.exec(header)?.[1];
      const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
      if (!t || v1 !== expected) throw new GatewayError("Invalid Crypto.com Pay signature");
    }
    const type = str(data.type);
    const pay = obj(obj(data.data).object);
    const out: PaymentEvent[] = [];
    if (type === "payment.captured" || (type === "payment.updated" && str(pay.status) === "succeeded")) {
      const ref = decodeRef(str(obj(pay.metadata).ref));
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(pay.amount) / 100, currency: str(pay.currency) || "USD", transactionId: str(pay.id) });
    } else if (type === "payment.refunded") {
      out.push({ type: "refund", transactionId: str(pay.id) });
    } else out.push({ type: "ignored", note: type });
    return out;
  },
  async cancelSubscription() { /* one-time payments only */ },
};
