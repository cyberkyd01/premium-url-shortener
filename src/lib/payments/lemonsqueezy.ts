/** Lemon Squeezy gateway. Config keys: apiKey, storeId, variantMonthly, variantYearly, variantLifetime (fallback variant ids), webhookSecret.
 *  Env: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET. Checkout uses a custom price override per plan. */
import crypto from "crypto";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, toCents, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config } = await gatewayConfig("lemonsqueezy");
  const key = cfg(config, "apiKey", "LEMONSQUEEZY_API_KEY");
  const storeId = cfg(config, "storeId", "LEMONSQUEEZY_STORE_ID");
  if (!key || !storeId) throw new GatewayError("Lemon Squeezy is not configured: missing API key or store id");
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch("https://api.lemonsqueezy.com/v1" + path, { method, headers: { authorization: `Bearer ${key}`, accept: "application/vnd.api+json", "content-type": "application/vnd.api+json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) { const errs = Array.isArray(d.errors) ? (d.errors as { detail?: string }[]).map((e) => e.detail).join(", ") : String(r.status); throw new GatewayError(`Lemon Squeezy ${path} failed: ${errs}`); }
    return d;
  };
  return { api, config, storeId };
}

async function variantFor(api: (m: string, p: string) => Promise<Record<string, unknown>>, config: Record<string, string>, storeId: string, interval: string) {
  const configured = config[`variant${interval[0].toUpperCase()}${interval.slice(1)}`];
  if (configured) return configured;
  // fallback: first variant of the store
  const list = await api("GET", `/variants?filter[store_id]=${storeId}`);
  const first = (Array.isArray(list.data) ? (list.data as Record<string, unknown>[]) : [])[0];
  if (!first) throw new GatewayError("No Lemon Squeezy variant found; create a product in your store and set variant ids in the gateway config");
  return str(first.id);
}

export const lemonsqueezyGateway: Gateway = {
  slug: "lemonsqueezy",
  name: "Lemon Squeezy",
  supportsSubscriptions: true,
  configKeys: ["apiKey", "storeId", "variantMonthly", "variantYearly", "variantLifetime", "webhookSecret"],
  async createCheckout(p) {
    const { api, config, storeId } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const variantId = await variantFor(api, config, storeId, p.interval);
    const d = await api("POST", "/checkouts", { data: { type: "checkouts", attributes: { custom_price: toCents(p.amount), product_options: { name: `${p.plan.name} (${p.interval})`, redirect_url: p.successUrl }, checkout_data: { email: p.user.email, name: p.user.name ?? p.user.username, custom: { ref, user_id: p.user.id } } }, relationships: { store: { data: { type: "stores", id: storeId } }, variant: { data: { type: "variants", id: variantId } } } } });
    return { url: str(obj(obj(d.data).attributes).url) };
  },
  async handleWebhook(req) {
    const { config } = await base();
    const { raw, data } = await readBody(req);
    const secret = cfg(config, "webhookSecret", "LEMONSQUEEZY_WEBHOOK_SECRET");
    if (secret) {
      const sig = req.headers.get("x-signature") ?? "";
      const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
      if (!sig || !crypto.timingSafeEqual(Buffer.from(sig.padEnd(expected.length)), Buffer.from(expected))) throw new GatewayError("Invalid Lemon Squeezy signature");
    }
    const meta = obj(data.meta);
    const event = str(meta.event_name);
    const custom = obj(meta.custom_data);
    const attrs = obj(obj(data.data).attributes);
    const id = str(obj(data.data).id);
    const ref = decodeRef(str(custom.ref));
    const out: PaymentEvent[] = [];
    if (event === "order_created" && str(attrs.status) === "paid") {
      if (ref && ref.interval === "lifetime") out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(attrs.total) / 100, currency: str(attrs.currency) || "USD", transactionId: id });
      else out.push({ type: "ignored", note: "order for subscription; waiting for subscription_payment_success" });
    } else if (event === "subscription_payment_success") {
      if (ref) {
        const existing = await db.payment.findFirst({ where: { gateway: "lemonsqueezy", status: "completed", userId: ref.userId } });
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(attrs.total) / 100, currency: str(attrs.currency) || "USD", transactionId: id, gatewaySubId: str(attrs.subscription_id) || undefined });
      }
    } else if (event === "subscription_created" || event === "subscription_updated") {
      const status = str(attrs.status);
      if (["cancelled", "expired", "unpaid", "paused"].includes(status)) out.push({ type: "subscription_cancelled", gatewaySubId: id });
      else out.push({ type: "subscription_updated", gatewaySubId: id, status, currentPeriodEnd: attrs.renews_at ? new Date(str(attrs.renews_at)) : undefined });
    } else if (event === "subscription_cancelled" || event === "subscription_expired") {
      out.push({ type: "subscription_cancelled", gatewaySubId: id });
    } else if (event === "order_refunded") {
      out.push({ type: "refund", transactionId: id });
    } else out.push({ type: "ignored", note: event });
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    await api("DELETE", `/subscriptions/${sub.gatewaySubId}`);
  },
};
