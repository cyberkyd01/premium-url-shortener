/** Mollie gateway (Payments API; recurring via first payment + subscriptions). Config keys: apiKey. Env: MOLLIE_API_KEY.
 *  Webhook: Mollie POSTs `id=tr_xxx`; we fetch the payment to verify status. */
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig, num, obj, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";
import { appUrl } from "@/lib/utils";

async function base() {
  const { config } = await gatewayConfig("mollie");
  const key = cfg(config, "apiKey", "MOLLIE_API_KEY");
  if (!key) throw new GatewayError("Mollie is not configured: missing API key");
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch("https://api.mollie.com/v2" + path, { method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) throw new GatewayError(`Mollie ${path} failed: ${str(d.detail || r.status)}`);
    return d;
  };
  return { api };
}

async function customerFor(api: (m: string, p: string, b?: unknown) => Promise<Record<string, unknown>>, email: string, name: string) {
  const list = await api("GET", `/customers?limit=250`).catch(() => null);
  const arr = (obj(list?._embedded).customers as Record<string, unknown>[] | undefined) ?? [];
  const found = arr.find((c) => str(c.email) === email);
  if (found) return str(found.id);
  const c = await api("POST", "/customers", { name, email });
  return str(c.id);
}

export const mollieGateway: Gateway = {
  slug: "mollie",
  name: "Mollie",
  supportsSubscriptions: true,
  configKeys: ["apiKey"],
  async createCheckout(p) {
    const { api } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const customerId = await customerFor(api, p.user.email, p.user.name ?? p.user.username);
    const pay = await api("POST", "/payments", {
      amount: { currency: p.currency, value: p.amount.toFixed(2) }, description: `${p.plan.name} plan (${p.interval})`, redirectUrl: p.successUrl, cancelUrl: p.cancelUrl,
      webhookUrl: appUrl("/api/webhooks/mollie"), metadata: { ref }, customerId, ...(p.interval !== "lifetime" ? { sequenceType: "first" } : {}),
    });
    return { url: str(obj(obj(pay._links).checkout).href) };
  },
  async handleWebhook(req) {
    const { api } = await base();
    const text = await req.text();
    const form = new URLSearchParams(text);
    const id = form.get("id") ?? (() => { try { return str((JSON.parse(text) as { id?: string }).id); } catch { return ""; } })();
    if (!id) return [{ type: "ignored", note: "no id" }];
    const out: PaymentEvent[] = [];
    if (id.startsWith("tr_")) {
      const pay = await api("GET", `/payments/${id}`);
      const status = str(pay.status);
      const ref = decodeRef(str(obj(pay.metadata).ref));
      if (status === "paid" && ref) {
        const subId = str(pay.subscriptionId);
        const existing = subId ? await db.payment.findFirst({ where: { gateway: "mollie", status: "completed", userId: ref.userId } }) : null;
        out.push({ type: "payment", ...ref, paymentId: existing ? undefined : ref.paymentId, couponCode: ref.couponCode ?? undefined, amount: num(obj(pay.amount).value), currency: str(obj(pay.amount).currency) || "EUR", transactionId: id, gatewaySubId: subId || undefined });
        // after a successful first payment, create the recurring subscription
        if (ref.interval !== "lifetime" && str(pay.sequenceType) === "first" && pay.customerId) {
          const plan = await db.plan.findUnique({ where: { id: ref.planId } });
          if (plan) {
            const sub = await api("POST", `/customers/${str(pay.customerId)}/subscriptions`, { amount: pay.amount, interval: ref.interval === "yearly" ? "12 months" : "1 month", description: `${plan.name} plan (${ref.interval})`, webhookUrl: appUrl("/api/webhooks/mollie"), metadata: { ref }, startDate: new Date(Date.now() + (ref.interval === "yearly" ? 365 : 30) * 86400_000).toISOString().slice(0, 10) }).catch(() => null);
            if (sub) out[out.length - 1].gatewaySubId = str(sub.id);
          }
        }
      } else if (status === "refunded" || num(obj(pay.amountRefunded).value) > 0) {
        out.push({ type: "refund", transactionId: id });
      } else out.push({ type: "ignored", note: status });
    } else if (id.startsWith("sub_")) {
      out.push({ type: "ignored", note: "subscription event" });
    }
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { api } = await base();
    const user = await db.user.findUnique({ where: { id: sub.userId } });
    if (!user) return;
    const customerId = await customerFor(api, user.email, user.name ?? user.username);
    await api("DELETE", `/customers/${customerId}/subscriptions/${sub.gatewaySubId}`);
  },
  async refund(transactionId, amount) {
    const { api } = await base();
    const pay = await api("GET", `/payments/${transactionId}`);
    await api("POST", `/payments/${transactionId}/refunds`, { amount: amount ? { currency: str(obj(pay.amount).currency), value: amount.toFixed(2) } : pay.amount });
  },
};
