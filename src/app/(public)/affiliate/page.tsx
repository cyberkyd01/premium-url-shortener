import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";
import { Section, SectionTitle, FeatureCard } from "@/components/public/section";
import { Coins, Link2, Repeat, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Affiliate program", description: "Earn commissions by referring new customers." };

export default async function AffiliatePage() {
  const [s, user] = await Promise.all([getSettings(), currentUser()]);
  if (s["affiliate.enabled"] !== "1") notFound();
  const currency = s["payments.currency"] || s["site.currency"] || "USD";
  const commission = s["affiliate.commissionType"] === "fixed" ? formatMoney(parseFloat(s["affiliate.commission"] || "0"), currency) : `${s["affiliate.commission"]}%`;
  const recurring = s["affiliate.frequency"] === "recurring";
  const minPayout = formatMoney(parseFloat(s["affiliate.minPayout"] || "0"), currency);
  const cookieDays = s["affiliate.cookieDays"] || "30";
  return (
    <>
      <Section className="text-center pb-8">
        <SectionTitle eyebrow="Affiliate program" title={`Earn ${commission} for every customer you refer`} description={`Share your referral link and earn ${commission} ${recurring ? "of every payment, for as long as they stay subscribed" : "of the first payment made by each referred customer"}.`} />
        <Link href={user ? "/dashboard/affiliate" : "/register"} className="btn-primary">{user ? "Get your referral link" : "Join for free"}</Link>
      </Section>
      <Section className="py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <FeatureCard icon={<Coins size={18} />} title={`${commission} commission`} description={recurring ? "Recurring: earn on every renewal, not just the first payment." : "Paid on the first payment of each referred customer."} />
          <FeatureCard icon={<Link2 size={18} />} title={`${cookieDays}-day cookie`} description={`Visitors who sign up within ${cookieDays} days of clicking your link are credited to you.`} />
          <FeatureCard icon={<Wallet size={18} />} title={`${minPayout} minimum payout`} description="Request a payout from your dashboard once your balance reaches the minimum." />
          <FeatureCard icon={<Repeat size={18} />} title="Real-time tracking" description="See referrals, earnings and payout history in your affiliate dashboard." />
        </div>
      </Section>
      <Section className="py-8">
        <SectionTitle title="How it works" />
        <ol className="grid gap-4 md:grid-cols-3 list-none">
          {[
            ["1. Sign up", "Create a free account. Your unique referral link is available in the dashboard under Affiliate."],
            ["2. Share", "Post your link on your website, newsletter, social media or videos."],
            ["3. Earn", `Every time a referred user purchases a plan you earn ${commission}. Request a payout when you reach ${minPayout}.`],
          ].map(([t, d]) => <li key={t} className="card p-5"><p className="font-semibold mb-1">{t}</p><p className="text-sm text-muted">{d}</p></li>)}
        </ol>
      </Section>
      <Section className="py-8">
        <div className="card p-6 md:p-8 max-w-3xl mx-auto text-sm text-muted space-y-2">
          <p className="font-semibold text-fg">Program terms</p>
          <p>Self-referrals, coupon-only sites and paid ads bidding on our brand name are not allowed. Commissions become available after the refund period of the referred purchase has passed. We reserve the right to withhold commissions for fraudulent or abusive activity.</p>
        </div>
      </Section>
    </>
  );
}
