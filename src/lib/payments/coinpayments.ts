/** CoinPayments gateway (create_transaction + IPN). Config keys: publicKey, privateKey, merchantId, ipnSecret. Env: COINPAYMENTS_PUBLIC_KEY, COINPAYMENTS_PRIVATE_KEY, COINPAYMENTS_MERCHANT_ID, COINPAYMENTS_IPN_SECRET.
 *  Crypto payments are one-time: recurring plans are renewed manually by paying again before expiry. */
import crypto from "crypto";
import { db } from "@/lib/db";
import { gatewayConfig, num } from "./config";
import { cfg, decodeRef, encodeRef, GatewayError, type Gateway, type PaymentEvent } from "./types";
import { appUrl } from "@/lib/utils";

async function creds() {
  const { config } = await gatewayConfig("coinpayments");
  const pub = cfg(config, "publicKey", "COINPAYMENTS_PUBLIC_KEY");
  const priv = cfg(config, "privateKey", "COINPAYMENTS_PRIVATE_KEY");
  const merchant = cfg(config, "merchantId", "COINPAYMENTS_MERCHANT_ID");
  const ipnSecret = cfg(config, "ipnSecret", "COINPAYMENTS_IPN_SECRET");
  if (!pub || !priv) throw new GatewayError("CoinPayments is not configured: missing API keys");
  return { pub, priv, merchant, ipnSecret };
}

export const coinpaymentsGateway: Gateway = {
  slug: "coinpayments",
  name: "CoinPayments",
  supportsSubscriptions: false,
  configKeys: ["publicKey", "privateKey", "merchantId", "ipnSecret"],
  async createCheckout(p) {
    const { pub, priv } = await creds();
    const ref = encodeRef({ paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code });
    const body = new URLSearchParams({ version: "1", cmd: "create_transaction", key: pub, amount: p.amount.toFixed(2), currency1: p.currency, currency2: "BTC", buyer_email: p.user.email, item_name: `${p.plan.name} plan (${p.interval})`, custom: ref, invoice: p.paymentId, ipn_url: appUrl("/api/webhooks/coinpayments"), success_url: p.successUrl, cancel_url: p.cancelUrl, format: "json" });
    const hmac = crypto.createHmac("sha512", priv).update(body.toString()).digest("hex");
    const r = await fetch("https://www.coinpayments.net/api.php", { method: "POST", headers: { HMAC: hmac, "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
    const d = (await r.json()) as { error?: string; result?: { checkout_url?: string; txn_id?: string } };
    if (d.error !== "ok" || !d.result?.checkout_url) throw new GatewayError("CoinPayments error: " + (d.error ?? "unknown"));
    await db.payment.update({ where: { id: p.paymentId }, data: { transactionId: d.result.txn_id ?? null } }).catch(() => {});
    return { url: d.result.checkout_url };
  },
  async handleWebhook(req) {
    const { ipnSecret, merchant } = await creds();
    const raw = await req.text();
    if (ipnSecret) {
      const sig = req.headers.get("hmac") ?? "";
      const expected = crypto.createHmac("sha512", ipnSecret).update(raw).digest("hex");
      if (sig !== expected) throw new GatewayError("Invalid CoinPayments IPN signature");
    }
    const form = new URLSearchParams(raw);
    if (merchant && form.get("merchant") !== merchant) throw new GatewayError("Merchant id mismatch");
    const status = num(form.get("status"));
    const out: PaymentEvent[] = [];
    if (status >= 100 || status === 2) {
      const ref = decodeRef(form.get("custom"));
      if (ref) out.push({ type: "payment", ...ref, couponCode: ref.couponCode ?? undefined, amount: num(form.get("amount1")), currency: form.get("currency1") ?? "USD", transactionId: form.get("txn_id") ?? undefined });
    } else if (status < 0) {
      out.push({ type: "ignored", note: "cancelled/timed out" });
    } else out.push({ type: "ignored", note: `status ${status}` });
    return out;
  },
  async cancelSubscription() { /* no recurring billing: nothing to cancel */ },
};
