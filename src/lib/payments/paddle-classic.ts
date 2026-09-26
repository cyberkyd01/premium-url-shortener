/** Paddle Classic gateway. Config keys: vendorId, vendorAuthCode, publicKey (webhook verification, PEM). Env: PADDLE_VENDOR_ID, PADDLE_VENDOR_AUTH_CODE, PADDLE_PUBLIC_KEY. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";

async function creds() {
  const { config, mode } = await gatewayConfig("paddle-classic");
  const vendorId = cfg(config, "vendorId", "PADDLE_VENDOR_ID");
  const auth = cfg(config, "vendorAuthCode", "PADDLE_VENDOR_AUTH_CODE");
  if (!vendorId || !auth) throw new GatewayError("Paddle Classic is not configured: missing vendor id/auth code");
  const url = mode === "live" ? "https://vendors.paddle.com/api/2.0" : "https://sandbox-vendors.paddle.com/api/2.0";
  return { vendorId, auth, url, config };
}

/** PHP-style serialize used by Paddle Classic signature verification. */
function phpSerialize(data: Record<string, string>) {
  const keys = Object.keys(data).sort();
  let out = `a:${keys.length}:{`;
  for (const k of keys) {
    const v = data[k];
    out += `s:${Buffer.byteLength(k)}:"${k}";s:${Buffer.byteLength(v)}:"${v}";`;
  }
  return out + "}";
}

export const paddleClassicGateway: Gateway = {
  slug: "paddle-classic",
  name: "Paddle Classic",
  supportsSubscriptions: true,
  configKeys: ["vendorId", "vendorAuthCode", "publicKey"],
  async createCheckout(p) {
    const { vendorId, auth, url } = await creds();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const body = new URLSearchParams({ vendor_id: vendorId, vendor_auth_code: auth, title: `${p.plan.name} plan (${p.interval})`, prices: `${p.currency}:${p.amount.toFixed(2)}`, customer_email: p.user.email, passthrough: ref, return_url: p.successUrl, quantity_variable: "0" });
    if (p.interval !== "lifetime") {
      body.set("recurring_prices", `${p.currency}:${p.amount.toFixed(2)}`);
    }
    const r = await fetch(`${url}/product/generate_pay_link`, { method: "POST", body });
    const d = (await r.json()) as { success?: boolean; response?: { url?: string }; error?: { message?: string } };
    if (!d.success || !d.response?.url) throw new GatewayError("Paddle pay link failed: " + (d.error?.message ?? "unknown"));
    return { url: d.response.url };
  },
  async handleWebhook(req) {
    const { config } = await creds();
    const form = new URLSearchParams(await req.text());
    const data: Record<string, string> = {};
    form.forEach((v, k) => { data[k] = v; });
    const pub = cfg(config, "publicKey", "PADDLE_PUBLIC_KEY");
    if (pub) {
      const sig = data.p_signature ?? "";
      const copy = { ...data }; delete copy.p_signature;
      const ok = crypto.createVerify("sha1").update(phpSerialize(copy)).verify(pub.replace(/\\n/g, "\n"), sig, "base64");
      if (!ok) throw new GatewayError("Invalid Paddle Classic signature");
    }
    const alert = data.alert_name ?? "";
    const out: PaymentEvent[] = [];
    if (alert === "subscription_payment_succeeded" || alert === "payment_succeeded") {
      const ref = decodeRef(data.passthrough);
      if (ref) {
        const existing = await db.payment.findFirst({ where: { gateway: "paddle-classic", status: "completed", userId: ref.userId } });
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(data.sale_gross), currency: data.currency || "USD", transactionId: data.order_id, gatewaySubId: data.subscription_id || undefined, currentPeriodEnd: data.next_bill_date ? new Date(data.next_bill_date) : undefined });
      }
    } else if (alert === "subscription_cancelled") {
      out.push({ type: "subscription_cancelled", gatewaySubId: data.subscription_id });
    } else if (alert === "payment_refunded" || alert === "subscription_payment_refunded") {
      out.push({ type: "refund", transactionId: data.order_id });
    } else out.push({ type: "ignored", note: alert });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { vendorId, auth, url } = await creds();
    await fetch(`${url}/subscription/users_cancel`, { method: "POST", body: new URLSearchParams({ vendor_id: vendorId, vendor_auth_code: auth, subscription_id: sub.gatewaySubId }) });
  },
};
