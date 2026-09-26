/** Midtrans gateway (Snap). Config keys: serverKey, clientKey. Env: MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY. Mode sandbox|live. Notification URL: /api/webhooks/midtrans. */
import crypto from "crypto";
import { gatewayConfig, num, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";
import { db } from "@/lib/db";

async function base() {
  const { config, mode } = await gatewayConfig("midtrans");
  const key = cfg(config, "serverKey", "MIDTRANS_SERVER_KEY");
  if (!key) throw new GatewayError("Midtrans is not configured: missing server key");
  const snap = mode === "live" ? "https://app.midtrans.com/snap/v1" : "https://app.sandbox.midtrans.com/snap/v1";
  return { key, snap, config, mode };
}

export const midtransGateway: Gateway = {
  slug: "midtrans",
  name: "Midtrans",
  supportsSubscriptions: false,
  configKeys: ["serverKey", "clientKey"],
  async createCheckout(p) {
    const { key, snap } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    // Midtrans requires integer IDR amounts; other currencies are sent as-is (merchant account currency applies).
    const gross = p.currency === "IDR" ? Math.round(p.amount) : Math.round(p.amount * 100) / 100;
    const r = await fetch(`${snap}/transactions`, { method: "POST", headers: { authorization: "Basic " + Buffer.from(`${key}:`).toString("base64"), "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ transaction_details: { order_id: p.paymentId, gross_amount: gross }, customer_details: { email: p.user.email, first_name: p.user.name ?? p.user.username }, item_details: [{ id: p.plan.id, price: gross, quantity: 1, name: `${p.plan.name} (${p.interval})`.slice(0, 50) }], custom_field1: ref, callbacks: { finish: p.successUrl, error: p.cancelUrl } }) });
    const d = (await r.json().catch(() => ({}))) as { redirect_url?: string; token?: string; error_messages?: string[] };
    if (!r.ok || !d.redirect_url) throw new GatewayError("Midtrans error: " + (d.error_messages?.join(", ") ?? r.status));
    return { url: d.redirect_url };
  },
  async handleWebhook(req) {
    const { key } = await base();
    const { data } = await readBody(req);
    const orderId = str(data.order_id);
    const statusCode = str(data.status_code);
    const gross = str(data.gross_amount);
    const expected = crypto.createHash("sha512").update(`${orderId}${statusCode}${gross}${key}`).digest("hex");
    if (str(data.signature_key) !== expected) throw new GatewayError("Invalid Midtrans signature");
    const status = str(data.transaction_status);
    const fraud = str(data.fraud_status);
    const out: PaymentEvent[] = [];
    if ((status === "capture" && fraud !== "challenge") || status === "settlement") {
      let ref = decodeRef(str(data.custom_field1));
      if (!ref) {
        const pending = await db.payment.findUnique({ where: { id: orderId } });
        if (pending && pending.planId) ref = { paymentId: pending.id, userId: pending.userId, planId: pending.planId, interval: pending.interval as "monthly" | "yearly" | "lifetime", couponCode: pending.couponCode };
      }
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(gross), currency: str(data.currency) || "IDR", transactionId: str(data.transaction_id) });
    } else if (status === "refund" || status === "partial_refund") {
      out.push({ type: "refund", transactionId: str(data.transaction_id) });
    } else out.push({ type: "ignored", note: status });
    return out;
  },
  async cancelSubscription() { /* no recurring billing */ },
};
