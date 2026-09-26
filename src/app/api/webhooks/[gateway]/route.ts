import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getGateway, applyPayment, markSubscriptionCancelled, markRefunded, GatewayError, type PaymentEvent } from "@/lib/payments";
import { appUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processEvents(slug: string, events: PaymentEvent[]) {
  const results: string[] = [];
  for (const ev of events) {
    try {
      if (ev.type === "payment") {
        let { userId, planId, interval } = ev;
        let couponCode = ev.couponCode ?? null;
        if ((!userId || !planId) && ev.paymentId) {
          const pending = await db.payment.findUnique({ where: { id: ev.paymentId } });
          if (pending) { userId = pending.userId; planId = pending.planId ?? undefined; interval = pending.interval as PaymentEvent["interval"]; couponCode = couponCode ?? pending.couponCode; }
        }
        if ((!userId || !planId) && ev.gatewaySubId) {
          const sub = await db.subscription.findFirst({ where: { gatewaySubId: ev.gatewaySubId } });
          if (sub) { userId = sub.userId; planId = sub.planId; interval = sub.interval as PaymentEvent["interval"]; }
        }
        if (!userId || !planId) { results.push("payment: missing user/plan reference"); continue; }
        const paid = await applyPayment({ userId, planId, interval: interval ?? "monthly", gateway: slug, amount: ev.amount ?? 0, currency: ev.currency, transactionId: ev.transactionId, couponCode, paymentId: ev.paymentId, gatewaySubId: ev.gatewaySubId, currentPeriodEnd: ev.currentPeriodEnd ?? null });
        results.push(`payment ${paid.id} completed`);
      } else if (ev.type === "subscription_cancelled") {
        await markSubscriptionCancelled({ gatewaySubId: ev.gatewaySubId, gateway: slug });
        results.push("subscription cancelled");
      } else if (ev.type === "subscription_updated") {
        if (ev.gatewaySubId) await db.subscription.updateMany({ where: { gatewaySubId: ev.gatewaySubId }, data: { status: "active", ...(ev.currentPeriodEnd ? { currentPeriodEnd: ev.currentPeriodEnd } : {}) } });
        results.push("subscription updated");
      } else if (ev.type === "refund") {
        if (ev.transactionId) await markRefunded(slug, ev.transactionId);
        results.push("refund recorded");
      } else results.push(`ignored: ${ev.note ?? ""}`);
    } catch (e) {
      console.error(`[webhook:${slug}]`, e);
      results.push("error: " + (e instanceof Error ? e.message : "unknown"));
    }
  }
  return results;
}

async function handle(req: NextRequest, slug: string) {
  const gateway = getGateway(slug);
  if (!gateway) return NextResponse.json({ error: true, message: "Unknown gateway" }, { status: 404 });
  try {
    const events = await gateway.handleWebhook(req);
    const results = await processEvents(slug, events);
    // iyzico / midtrans redirect the customer's browser here after payment: send them to the success page.
    const browser = (req.headers.get("accept") ?? "").includes("text/html");
    if (browser && (slug === "iyzico" || slug === "midtrans")) return NextResponse.redirect(appUrl("/checkout/success"), 303);
    return NextResponse.json({ received: true, results });
  } catch (e) {
    const status = e instanceof GatewayError ? e.status : 500;
    console.error(`[webhook:${slug}]`, e);
    return NextResponse.json({ error: true, message: e instanceof Error ? e.message : "Webhook error" }, { status });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params;
  return handle(req, gateway);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const { gateway } = await ctx.params;
  if (gateway === "iyzico" || gateway === "midtrans") return handle(req, gateway);
  return NextResponse.json({ ok: true, gateway });
}
