/** iyzico gateway (Checkout Form). Config keys: apiKey, secretKey. Env: IYZICO_API_KEY, IYZICO_SECRET_KEY. Mode sandbox|live.
 *  Callback: iyzico POSTs `token` to /api/webhooks/iyzico; we retrieve the checkout form result to confirm. One-time payments only. */
import crypto from "crypto";
import { db } from "@/lib/db";
import { gatewayConfig, num, readBody, str } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";
import { appUrl } from "@/lib/utils";

async function base() {
  const { config, mode } = await gatewayConfig("iyzico");
  const apiKey = cfg(config, "apiKey", "IYZICO_API_KEY");
  const secret = cfg(config, "secretKey", "IYZICO_SECRET_KEY");
  if (!apiKey || !secret) throw new GatewayError("iyzico is not configured: missing API key/secret");
  const url = mode === "live" ? "https://api.iyzipay.com" : "https://sandbox-api.iyzipay.com";
  const api = async (path: string, body: Record<string, unknown>) => {
    const rnd = crypto.randomBytes(8).toString("hex");
    const payload = JSON.stringify(body);
    const sig = crypto.createHmac("sha256", secret).update(rnd + path + payload).digest("hex");
    const auth = "IYZWSv2 " + Buffer.from(`apiKey:${apiKey}&randomKey:${rnd}&signature:${sig}`).toString("base64");
    const r = await fetch(url + path, { method: "POST", headers: { authorization: auth, "x-iyzi-rnd": rnd, "content-type": "application/json" }, body: payload });
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (str(d.status) !== "success") throw new GatewayError(`iyzico ${path} failed: ${str(d.errorMessage || r.status)}`);
    return d;
  };
  return { api };
}

export const iyzicoGateway: Gateway = {
  slug: "iyzico",
  name: "iyzico",
  supportsSubscriptions: false,
  configKeys: ["apiKey", "secretKey"],
  async createCheckout(p) {
    const { api } = await base();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const price = p.amount.toFixed(2);
    const name = (p.user.name ?? p.user.username).split(" ");
    const buyer = { id: p.user.id, name: name[0] || "Customer", surname: name.slice(1).join(" ") || "-", email: p.user.email, identityNumber: "11111111111", registrationAddress: p.billing.address || "-", city: p.billing.city || "-", country: p.billing.country || "TR", ip: "127.0.0.1" };
    const address = { contactName: p.user.name ?? p.user.username, city: p.billing.city || "-", country: p.billing.country || "TR", address: p.billing.address || "-" };
    const d = await api("/payment/iyzipos/checkoutform/initialize/auth/ecom", {
      locale: "en", conversationId: p.paymentId, price, paidPrice: price, currency: p.currency, basketId: p.paymentId, paymentGroup: "SUBSCRIPTION",
      callbackUrl: appUrl(`/api/webhooks/iyzico?ref=${encodeURIComponent(ref)}`), enabledInstallments: [1], buyer, shippingAddress: address, billingAddress: address,
      basketItems: [{ id: p.plan.id, name: `${p.plan.name} (${p.interval})`, category1: "Subscription", itemType: "VIRTUAL", price }],
    });
    const url = str(d.paymentPageUrl);
    if (!url) throw new GatewayError("iyzico did not return a payment page URL");
    return { url };
  },
  async handleWebhook(req) {
    const { api } = await base();
    const u = new URL(req.url);
    const ct = req.headers.get("content-type") ?? "";
    let token = "";
    if (ct.includes("json")) { const { data } = await readBody(req); token = str(data.token); }
    else { const form = new URLSearchParams(await req.text()); token = form.get("token") ?? ""; }
    if (!token) return [{ type: "ignored", note: "no token" }];
    const d = await api("/payment/iyzipos/checkoutform/auth/ecom/detail", { locale: "en", token });
    const out: PaymentEvent[] = [];
    if (str(d.paymentStatus) === "SUCCESS") {
      let ref = decodeRef(u.searchParams.get("ref"));
      if (!ref) {
        const pending = await db.payment.findUnique({ where: { id: str(d.basketId) } });
        if (pending?.planId) ref = { paymentId: pending.id, userId: pending.userId, planId: pending.planId, interval: pending.interval as "monthly" | "yearly" | "lifetime", couponCode: pending.couponCode };
      }
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(d.paidPrice), currency: str(d.currency) || "TRY", transactionId: str(d.paymentId) });
    } else out.push({ type: "ignored", note: str(d.paymentStatus) });
    return out;
  },
  async cancelSubscription() { /* one-time payments only */ },
};
