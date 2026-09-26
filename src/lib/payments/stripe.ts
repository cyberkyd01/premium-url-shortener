/** Stripe gateway. Config keys (PaymentGateway.config JSON): secretKey, publishableKey, webhookSecret.
 *  Env fallback: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET. */
import Stripe from "stripe";
import type { Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { gatewayConfig } from "./config";
import { cfg, GatewayError, toCents, type CheckoutParams, type CheckoutResult, type Gateway, type Interval, type PaymentEvent } from "./types";

async function client() {
  const { config } = await gatewayConfig("stripe");
  const key = cfg(config, "secretKey", "STRIPE_SECRET_KEY");
  if (!key) throw new GatewayError("Stripe is not configured: missing secret key");
  return { stripe: new Stripe(key), config };
}

async function ensureCustomer(stripe: Stripe, user: CheckoutParams["user"]) {
  const existing = await stripe.customers.search({ query: `email:'${user.email.replace(/'/g, "")}'`, limit: 1 }).catch(() => null);
  if (existing?.data[0]) return existing.data[0].id;
  const c = await stripe.customers.create({ email: user.email, name: user.name ?? user.username, metadata: { userId: user.id } });
  return c.id;
}

/** Creates Stripe products + recurring prices for every paid plan and stores the ids on Plan. */
export async function syncPlansWithStripe() {
  const { stripe } = await client();
  const plans = await db.plan.findMany({ where: { isFree: false } });
  let synced = 0;
  for (const plan of plans) {
    let productId = plan.stripeProductId;
    if (productId) {
      await stripe.products.update(productId, { name: plan.name, description: plan.description || undefined }).catch(() => { productId = null; });
    }
    if (!productId) productId = (await stripe.products.create({ name: plan.name, description: plan.description || undefined, metadata: { planId: plan.id } })).id;
    const currency = (plan.currency || "USD").toLowerCase();
    const makePrice = async (existing: string | null, amount: number, interval: "month" | "year") => {
      if (amount <= 0) return null;
      if (existing) {
        const p = await stripe.prices.retrieve(existing).catch(() => null);
        if (p && p.unit_amount === toCents(amount) && p.currency === currency && p.active) return existing;
      }
      const created = await stripe.prices.create({ product: productId!, currency, unit_amount: toCents(amount), recurring: { interval }, metadata: { planId: plan.id } });
      return created.id;
    };
    const stripePriceMonthly = await makePrice(plan.stripePriceMonthly, plan.priceMonthly, "month");
    const stripePriceYearly = await makePrice(plan.stripePriceYearly, plan.priceYearly, "year");
    await db.plan.update({ where: { id: plan.id }, data: { stripeProductId: productId, stripePriceMonthly, stripePriceYearly } });
    synced++;
  }
  return { synced };
}

async function priceFor(stripe: Stripe, p: CheckoutParams): Promise<string> {
  const field = p.interval === "yearly" ? "stripePriceYearly" : "stripePriceMonthly";
  const id = p.plan[field];
  if (id) {
    const price = await stripe.prices.retrieve(id).catch(() => null);
    if (price && price.active) return id;
  }
  await syncPlansWithStripe();
  const fresh = await db.plan.findUnique({ where: { id: p.plan.id } });
  const newId = fresh?.[field];
  if (!newId) throw new GatewayError("Could not create a Stripe price for this plan");
  return newId;
}

export const stripeGateway: Gateway = {
  slug: "stripe",
  name: "Stripe",
  supportsSubscriptions: true,
  configKeys: ["secretKey", "publishableKey", "webhookSecret"],
  async createCheckout(p): Promise<CheckoutResult> {
    const { stripe } = await client();
    const customer = await ensureCustomer(stripe, p.user);
    const metadata = { paymentId: p.paymentId, userId: p.user.id, planId: p.plan.id, interval: p.interval, couponCode: p.coupon?.code ?? "" };
    const currency = p.currency.toLowerCase();
    if (p.interval === "lifetime") {
      const session = await stripe.checkout.sessions.create({
        mode: "payment", customer, success_url: p.successUrl, cancel_url: p.cancelUrl, metadata,
        line_items: [{ quantity: 1, price_data: { currency, unit_amount: toCents(p.amount), product_data: { name: `${p.plan.name} plan (lifetime)` } } }],
        payment_intent_data: { metadata },
      });
      return { url: session.url! };
    }
    const price = await priceFor(stripe, p);
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (p.discount > 0 && p.coupon) {
      const c = await stripe.coupons.create(p.coupon.type === "percent" ? { percent_off: p.coupon.amount, duration: "once", name: p.coupon.code } : { amount_off: toCents(p.discount), currency, duration: "once", name: p.coupon.code });
      discounts.push({ coupon: c.id });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer, success_url: p.successUrl, cancel_url: p.cancelUrl, metadata,
      line_items: [{ price, quantity: 1 }],
      discounts: discounts.length ? discounts : undefined,
      subscription_data: { metadata },
      ...(p.tax > 0 ? {} : {}),
    });
    return { url: session.url! };
  },
  async handleWebhook(req): Promise<PaymentEvent[]> {
    const { stripe, config } = await client();
    const secret = cfg(config, "webhookSecret", "STRIPE_WEBHOOK_SECRET");
    const raw = await req.text();
    let event: Stripe.Event;
    if (secret) {
      const sig = req.headers.get("stripe-signature") ?? "";
      try { event = stripe.webhooks.constructEvent(raw, sig, secret); } catch { throw new GatewayError("Invalid Stripe signature", 400); }
    } else {
      event = JSON.parse(raw) as Stripe.Event;
    }
    const out: PaymentEvent[] = [];
    const fromMeta = (m: Stripe.Metadata | null | undefined): Partial<PaymentEvent> => ({ paymentId: m?.paymentId || undefined, userId: m?.userId || undefined, planId: m?.planId || undefined, interval: (m?.interval as Interval) || undefined, couponCode: m?.couponCode || undefined });
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode === "payment" && s.payment_status === "paid") {
          out.push({ type: "payment", ...fromMeta(s.metadata), amount: (s.amount_total ?? 0) / 100, currency: (s.currency ?? "usd").toUpperCase(), transactionId: typeof s.payment_intent === "string" ? s.payment_intent : s.id });
        } else if (s.mode === "subscription") {
          // invoice.paid carries the money; nothing to do here but note the subscription id
          out.push({ type: "ignored", note: "subscription checkout completed" });
        }
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object;
        // Stripe API 2025+: subscription lives under invoice.parent.subscription_details; older versions expose invoice.subscription
        const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
        const modern = inv.parent?.subscription_details?.subscription;
        const subRef = modern ?? legacy;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const meta = fromMeta(sub.metadata);
        const first = inv.billing_reason === "subscription_create";
        const periodEnd = sub.items.data[0]?.current_period_end;
        out.push({ type: "payment", ...(first ? meta : { ...meta, paymentId: undefined }), amount: (inv.amount_paid ?? 0) / 100, currency: (inv.currency ?? "usd").toUpperCase(), transactionId: inv.id, gatewaySubId: sub.id, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        if (sub.cancel_at_period_end || sub.status === "canceled" || sub.status === "unpaid") out.push({ type: "subscription_cancelled", gatewaySubId: sub.id });
        else out.push({ type: "subscription_updated", gatewaySubId: sub.id, status: sub.status });
        break;
      }
      case "customer.subscription.deleted": {
        out.push({ type: "subscription_cancelled", gatewaySubId: event.data.object.id });
        break;
      }
      case "charge.refunded": {
        const ch = event.data.object;
        out.push({ type: "refund", transactionId: typeof ch.payment_intent === "string" ? ch.payment_intent : ch.id });
        break;
      }
      default:
        out.push({ type: "ignored", note: event.type });
    }
    return out;
  },
  async cancelSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { stripe } = await client();
    await stripe.subscriptions.update(sub.gatewaySubId, { cancel_at_period_end: true });
  },
  async resumeSubscription(sub: Subscription) {
    if (!sub.gatewaySubId) return;
    const { stripe } = await client();
    await stripe.subscriptions.update(sub.gatewaySubId, { cancel_at_period_end: false });
  },
  async refund(transactionId, amount) {
    const { stripe } = await client();
    if (transactionId.startsWith("in_")) {
      const inv = await stripe.invoices.retrieve(transactionId);
      const pi = (inv as unknown as { payment_intent?: string | { id: string } | null }).payment_intent;
      const piId = typeof pi === "string" ? pi : pi?.id;
      if (!piId) throw new GatewayError("Invoice has no payment intent to refund");
      await stripe.refunds.create({ payment_intent: piId, amount: amount ? toCents(amount) : undefined });
      return;
    }
    await stripe.refunds.create({ payment_intent: transactionId, amount: amount ? toCents(amount) : undefined });
  },
  syncPlans: syncPlansWithStripe,
};
