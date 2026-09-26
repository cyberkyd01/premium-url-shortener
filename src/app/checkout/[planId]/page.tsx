import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { enabledGateways } from "@/lib/payments";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { quote, trialEligible } from "../actions";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ interval?: string; coupon?: string }> }) {
  const { planId } = await params;
  const { interval = "monthly", coupon = "" } = await searchParams;
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(`/checkout/${planId}?interval=${interval}`)}`);
  const s = await getSettings();
  const plan = (await db.plan.findUnique({ where: { id: planId } })) ?? (await db.plan.findUnique({ where: { slug: planId } }));
  if (!plan || plan.isFree || !plan.isPublic || s["payments.enabled"] !== "1") redirect("/pricing");
  const user = await db.user.findUnique({ where: { id: u.id } });
  if (!user) redirect("/login");
  const chosen = ["monthly", "yearly", "lifetime"].includes(interval) && (interval === "monthly" ? plan.priceMonthly : interval === "yearly" ? plan.priceYearly : plan.priceLifetime) > 0 ? interval : plan.priceMonthly > 0 ? "monthly" : plan.priceYearly > 0 ? "yearly" : "lifetime";
  const [gws, q, trial] = await Promise.all([enabledGateways(), quote({ planId: plan.id, interval: chosen, coupon: coupon || undefined }), trialEligible(u.id)]);
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="font-bold text-lg">{s["site.name"]}</Link>
          <Link href="/pricing" className="text-sm text-muted hover:text-fg">Back to pricing</Link>
        </div>
        <h1 className="text-2xl font-bold mb-1">Checkout: {plan.name}</h1>
        {plan.description && <p className="text-muted text-sm mb-6">{plan.description}</p>}
        <CheckoutForm plan={{ id: plan.id, name: plan.name, description: plan.description, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, priceLifetime: plan.priceLifetime, currency: plan.currency, trialDays: plan.trialDays }} interval={chosen} gateways={gws.map((g) => ({ slug: g.gateway.slug, name: g.row.name || g.gateway.name, supportsSubscriptions: g.gateway.supportsSubscriptions }))} user={{ name: user.name ?? user.username, email: user.email }} initialQuote={q} trialEligible={trial} taxEnabled={s["payments.taxEnabled"] === "1"} initialCoupon={coupon} />
      </div>
    </div>
  );
}
