/** PayPal gateway (REST v2 Orders for one-time, Subscriptions API for recurring).
 *  Config keys: clientId, clientSecret, webhookId. Env fallback: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID. Mode from PaymentGateway.mode (sandbox|live). */
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type CheckoutParams, type Gateway, type PaymentEvent } from "./types";

async function base() {
  const { config, mode } = await gatewayConfig("paypal");
  const id = cfg(config, "clientId", "PAYPAL_CLIENT_ID");
  const secret = cfg(config, "clientSecret", "PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new GatewayError("PayPal is not configured: missing client id/secret");
  const live = mode === "live" || (process.env.PAYPAL_MODE === "live" && mode !== "sandbox");
  const url = live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const tokenRes = await fetch(`${url}/v1/oauth2/token`, { method: "POST", headers: { authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenRes.ok || !tokenData.access_token) throw new GatewayError("PayPal auth failed: " + (tokenData.error_description ?? tokenRes.status));
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(url + path, { method, headers: { authorization: `Bearer ${tokenData.access_token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }
    if (!r.ok) throw new GatewayError(`PayPal ${method} ${path} failed: ${str(data.message || data.error_description || text)}`);
    return data;
  };
  return { api, config, url };
}

/** Creates PayPal products + billing plans for monthly/yearly prices and stores ids on Plan. */
export async function syncPlansWithPayPal() {
  const { api } = await base();
  const plans = await db.plan.findMany({ where: { isFree: false } });
  let synced = 0;
  for (const plan of plans) {
    const product = (await api("POST", "/v1/catalogs/products", { name: plan.name, description: plan.description || plan.name, type: "SERVICE" })) as { id: string };
    const make = async (existing: string | null, amount: number, unit: "MONTH" | "YEAR") => {
      if (amount <= 0) return null;
      if (existing) return existing; // PayPal plans are immutable in price; keep existing
      const created = (await api("POST", "/v1/billing/plans", {
        product_id: product.id, name: `${plan.name} ${unit === "MONTH" ? "monthly" : "yearly"}`, status: "ACTIVE",
        billing_cycles: [{ frequency: { interval_unit: unit, interval_count: 1 }, tenure_type: "REGULAR", sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: amount.toFixed(2), currency_code: plan.currency || "USD" } } }],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
      })) as { id: string };
      return created.id;
    };
    const paypalPlanMonthly = await make(plan.paypalPlanMonthly, plan.priceMonthly, "MONTH");
    const paypalPlanYearly = await make(plan.paypalPlanYearly, plan.priceYearly, "YEAR");
    await db.plan.update({ where: { id: plan.id }, data: { paypalPlanMonthly, paypalPlanYearly } });
    synced++;
  }
  return { synced };
}

function approveLink(links: unknown) {
  const arr = Array.isArray(links) ? (links as { rel?: string; href?: string }[]) : [];
  return arr.find((l) => l.rel === "approve")?.href ?? "";
}

export const paypalGateway: Gateway = {
  slug: "paypal",
  name: "PayPal",
  supportsSubscriptions: true,
  configKeys: ["clientId", "clientSecret", "webhookId"],
  async createCheckout(p: CheckoutParams) {
    const { api } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const useSubscription = p.interval !== "lifetime" && p.discount === 0 && p.tax === 0;
    if (useSubscription) {
      let planField = p.interval === "yearly" ? p.plan.paypalPlanYearly : p.plan.paypalPlanMonthly;
      if (!planField) {
        await syncPlansWithPayPal();
        const fresh = await db.plan.findUnique({ where: { id: p.plan.id } });
        planField = p.interval === "yearly" ? fresh?.paypalPlanYearly ?? null : fresh?.paypalPlanMonthly ?? null;
      }
      if (planField) {
        const sub = await api("POST", "/v1/billing/subscriptions", { plan_id: planField, custom_id: ref, subscriber: { email_address: p.user.email }, application_context: { brand_name: "Subscription", user_action: "SUBSCRIBE_NOW", return_url: p.successUrl, cancel_url: p.cancelUrl } });
        return { url: approveLink(sub.links) };
      }
    }
    const order = await api("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{ custom_id: ref, description: `${p.plan.name} plan (${p.interval})`, amount: { currency_code: p.currency, value: p.amount.toFixed(2) } }],
      application_context: { user_action: "PAY_NOW", return_url: p.successUrl, cancel_url: p.cancelUrl },
    });
    return { url: approveLink(order.links) };
  },
  async handleWebhook(req) {
    const { api, config } = await base();
    const { raw, data } = await readBody(req);
    const webhookId = cfg(config, "webhookId", "PAYPAL_WEBHOOK_ID");
    if (webhookId) {
      const v = await api("POST", "/v1/notifications/verify-webhook-signature", {
        auth_algo: req.headers.get("paypal-auth-algo"), cert_url: req.headers.get("paypal-cert-url"), transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"), transmission_time: req.headers.get("paypal-transmission-time"), webhook_id: webhookId, webhook_event: JSON.parse(raw),
      });
      if (v.verification_status !== "SUCCESS") throw new GatewayError("Invalid PayPal webhook signature");
    }
    const type = str(data.event_type);
    const res = obj(data.resource);
    const out: PaymentEvent[] = [];
    if (type === "CHECKOUT.ORDER.APPROVED") {
      const captured = await api("POST", `/v2/checkout/orders/${str(res.id)}/capture`).catch(() => null);
      const unit = obj((captured?.purchase_units as unknown[] | undefined)?.[0]);
      const cap = obj((obj(unit.payments).captures as unknown[] | undefined)?.[0]);
      const ref = decodeRef(str(unit.custom_id));
      if (captured && ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(obj(cap.amount).value), currency: str(obj(cap.amount).currency_code) || "USD", transactionId: str(cap.id) || str(res.id) });
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const ref = decodeRef(str(res.custom_id));
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(obj(res.amount).value), currency: str(obj(res.amount).currency_code) || "USD", transactionId: str(res.id) });
    } else if (type === "PAYMENT.SALE.COMPLETED") {
      // recurring subscription payment
      const subId = str(res.billing_agreement_id);
      const sub = subId ? await api("GET", `/v1/billing/subscriptions/${subId}`).catch(() => null) : null;
      const ref = decodeRef(str(sub?.custom_id ?? res.custom_id));
      if (ref) {
        const existing = await db.payment.findFirst({ where: { gateway: "paypal", status: "completed", userId: ref.userId } });
        const nextBilling = obj(sub?.billing_info).next_billing_time;
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(obj(res.amount).total), currency: str(obj(res.amount).currency) || "USD", transactionId: str(res.id), gatewaySubId: subId || undefined, currentPeriodEnd: nextBilling ? new Date(str(nextBilling)) : undefined });
      }
    } else if (type === "BILLING.SUBSCRIPTION.CANCELLED" || type === "BILLING.SUBSCRIPTION.SUSPENDED" || type === "BILLING.SUBSCRIPTION.EXPIRED") {
      out.push({ type: "subscription_cancelled", gatewaySubId: str(res.id) });
    } else if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.SALE.REFUNDED") {
      const links = Array.isArray(res.links) ? (res.links as { rel?: string; href?: string }[]) : [];
      const up = links.find((l) => l.rel === "up")?.href ?? "";
      out.push({ type: "refund", transactionId: up.split("/").pop() || str(res.id) });
    } else {
      out.push({ type: "ignored", note: type });
    }
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    await api("POST", `/v1/billing/subscriptions/${sub.gatewaySubId}/cancel`, { reason: "Cancelled by user" });
  },
  async refund(transactionId, amount) {
    const { api } = await base();
    await api("POST", `/v2/payments/captures/${transactionId}/refund`, amount ? { amount: { value: amount.toFixed(2), currency_code: "USD" } } : undefined);
  },
  syncPlans: syncPlansWithPayPal,
};
