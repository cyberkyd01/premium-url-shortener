/** MercadoPago gateway (Checkout Pro preferences; recurring via Preapproval). Config keys: accessToken, publicKey, webhookSecret.
 *  Env: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY, MERCADOPAGO_WEBHOOK_SECRET.
 *  Webhook: MercadoPago POSTs {type:"payment", data:{id}} (validated with the x-signature HMAC when a secret is set); we fetch the payment to confirm its status. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";

const API = "https://api.mercadopago.com";

async function base() {
  const { config, mode } = await gatewayConfig("mercadopago");
  const token = cfg(config, "accessToken", "MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new GatewayError("MercadoPago is not configured: missing access token");
  const secret = cfg(config, "webhookSecret", "MERCADOPAGO_WEBHOOK_SECRET");
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new GatewayError(`MercadoPago ${path} failed: ${str(d.message || d.error || r.status)}`);
    return d;
  };
  return { api, token, secret, sandbox: mode !== "live" };
}

/** Validates the `x-signature` header: HMAC-SHA256 over "id:{data.id};request-id:{x-request-id};ts:{ts};". */
function verifySignature(req: Request, secret: string, dataId: string) {
  const sig = req.headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const ts = parts.ts ?? "", v1 = parts.v1 ?? "";
  if (!ts || !v1) return false;
  const requestId = req.headers.get("x-request-id") ?? "";
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

async function paymentEvent(api: (m: string, p: string, b?: unknown) => Promise<Record<string, unknown>>, paymentId: string): Promise<PaymentEvent> {
  const pay = await api("GET", `/v1/payments/${paymentId}`);
  const status = str(pay.status);
  const ref = decodeRef(str(pay.external_reference));
  const meta = obj(pay.metadata);
  const info = ref ?? decodeRef(str(meta.ref));
  if (status === "refunded" || status === "charged_back") return { type: "refund", transactionId: paymentId };
  if (status !== "approved") return { type: "ignored", note: `payment ${status}` };
  if (!info) return { type: "ignored", note: "no reference" };
  // Recurring charges (preapproval) carry the preapproval id in metadata; only the first payment completes the pending Payment row.
  const preapprovalId = str(meta.preapproval_id) || undefined;
  const existing = preapprovalId ? await db.payment.findFirst({ where: { gateway: "mercadopago", status: "completed", userId: info.userId } }) : null;
  return { type: "payment", ...info, paymentId: existing ? undefined : info.paymentId, couponCode: info.couponCode ?? undefined, amount: num(pay.transaction_amount), currency: str(pay.currency_id) || "ARS", transactionId: paymentId, gatewaySubId: preapprovalId };
}

export const mercadopagoGateway: Gateway = {
  slug: "mercadopago",
  name: "MercadoPago",
  supportsSubscriptions: true,
  configKeys: ["accessToken", "publicKey", "webhookSecret"],
  async createCheckout(p) {
    const { api, sandbox } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const title = `${p.plan.name} plan (${p.interval})`;
    const notification_url = appUrl("/api/webhooks/mercadopago");
    if (p.interval !== "lifetime") {
      // Recurring subscription through Preapproval (the user authorises the recurring charge on MercadoPago's page).
      const pre = await api("POST", "/preapproval", {
        reason: title, external_reference: ref, payer_email: p.user.email, back_url: p.successUrl, notification_url,
        auto_recurring: { frequency: p.interval === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: Number(p.amount.toFixed(2)), currency_id: p.currency },
        status: "pending",
      });
      await db.payment.update({ where: { id: p.paymentId }, data: { transactionId: str(pre.id) || null } }).catch(() => undefined);
      const url = sandbox ? str(pre.sandbox_init_point) || str(pre.init_point) : str(pre.init_point);
      if (!url) throw new GatewayError("MercadoPago did not return a checkout URL");
      return { url };
    }
    const pref = await api("POST", "/checkout/preferences", {
      items: [{ id: p.plan.id, title, description: p.plan.description ?? undefined, quantity: 1, unit_price: Number(p.amount.toFixed(2)), currency_id: p.currency }],
      payer: { email: p.user.email, name: p.billing.name || p.user.name || undefined },
      back_urls: { success: p.successUrl, pending: p.successUrl, failure: p.cancelUrl }, auto_return: "approved",
      external_reference: ref, notification_url, metadata: { ref, payment_id: p.paymentId }, statement_descriptor: p.plan.name.slice(0, 22),
    });
    const url = sandbox ? str(pref.sandbox_init_point) || str(pref.init_point) : str(pref.init_point);
    if (!url) throw new GatewayError("MercadoPago did not return a checkout URL");
    return { url };
  },
  async handleWebhook(req) {
    const { api, secret } = await base();
    const { data } = await readBody(req);
    const url = new URL(req.url);
    const type = str(data.type || data.topic || url.searchParams.get("type") || url.searchParams.get("topic"));
    const dataId = str(obj(data.data).id || url.searchParams.get("data.id") || url.searchParams.get("id"));
    if (secret && dataId && !verifySignature(req, secret, dataId)) throw new GatewayError("Invalid MercadoPago signature", 401);
    if (!dataId) return [{ type: "ignored", note: "no id" }];
    const out: PaymentEvent[] = [];
    if (type === "payment") {
      out.push(await paymentEvent(api, dataId));
    } else if (type === "subscription_preapproval" || type === "preapproval") {
      const pre = await api("GET", `/preapproval/${dataId}`);
      const status = str(pre.status);
      const info = decodeRef(str(pre.external_reference));
      if (status === "cancelled" || status === "paused") out.push({ type: "subscription_cancelled", gatewaySubId: dataId });
      else if (status === "authorized" && info) {
        // Link the preapproval id to the subscription once the user authorised it; the first charge arrives as a payment event.
        await db.subscription.updateMany({ where: { userId: info.userId, gateway: "mercadopago", gatewaySubId: null }, data: { gatewaySubId: dataId } }).catch(() => undefined);
        out.push({ type: "subscription_updated", gatewaySubId: dataId, status });
      } else out.push({ type: "ignored", note: `preapproval ${status}` });
    } else if (type === "subscription_authorized_payment") {
      const auth = await api("GET", `/authorized_payments/${dataId}`).catch(() => null);
      const payId = auth ? str(obj(auth.payment).id) : "";
      if (payId) out.push(await paymentEvent(api, payId)); else out.push({ type: "ignored", note: "authorized payment without payment id" });
    } else out.push({ type: "ignored", note: type || "unknown" });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    await api("PUT", `/preapproval/${sub.gatewaySubId}`, { status: "cancelled" });
  },
  async refund(transactionId, amount) {
    const { api } = await base();
    await api("POST", `/v1/payments/${transactionId}/refunds`, amount ? { amount: Number(amount.toFixed(2)) } : undefined);
  },
};
