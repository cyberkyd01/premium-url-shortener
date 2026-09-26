import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { toPricingPlan } from "@/lib/pricing";
import { PricingGrid } from "@/components/public/pricing-grid";
import { Section, SectionTitle } from "@/components/public/section";

export const metadata: Metadata = { title: "Pricing", description: "Simple, transparent pricing. Start for free and upgrade as you grow." };

export default async function PricingPage() {
  const [s, user, plans, faqs] = await Promise.all([
    getSettings(), currentUser(),
    db.plan.findMany({ where: { isPublic: true }, orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }] }),
    db.faq.findMany({ where: { active: true }, orderBy: { order: "asc" }, take: 8 }),
  ]);
  const currency = s["payments.currency"] || s["site.currency"] || "USD";
  return (
    <>
      <Section className="pb-8">
        <SectionTitle eyebrow="Pricing" title="Plans for every stage" description="Start free, upgrade when you need more links, domains, team seats or advanced targeting. Cancel anytime." />
        {plans.length ? <PricingGrid plans={plans.map(toPricingPlan)} currency={currency} loggedIn={!!user} /> : <p className="text-center text-muted">No plans are available yet.</p>}
        <p className="text-center text-xs text-muted mt-6">Have a coupon or voucher code? You can apply it during checkout. Prices are shown in {currency}{s["payments.taxEnabled"] === "1" ? " and may be subject to tax" : ""}.</p>
      </Section>
      {s["payments.customPlanBanner"] === "1" && (
        <Section className="py-6">
          <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-primary/5">
            <div><h3 className="font-semibold text-lg">Enterprise & custom plans</h3><p className="text-sm text-muted">{s["payments.customPlanText"]}</p></div>
            <Link href={s["payments.customPlanUrl"] || "/contact"} className="btn-primary">Contact us</Link>
          </div>
        </Section>
      )}
      {faqs.length > 0 && (
        <Section>
          <SectionTitle title="Frequently asked questions" />
          <div className="max-w-3xl mx-auto divide-y divide-border card">
            {faqs.map((f) => (
              <details key={f.id} className="group p-5">
                <summary className="font-medium cursor-pointer list-none flex justify-between items-center">{f.question}<span className="text-muted group-open:rotate-45 transition">+</span></summary>
                <div className="text-sm text-muted mt-3 prose-content" dangerouslySetInnerHTML={{ __html: f.answer }} />
              </details>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
