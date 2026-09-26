import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { tempMailConfig } from "@/lib/tempmail";
import { Section, SectionTitle, FeatureCard } from "@/components/public/section";
import { GuestTempMail } from "./guest-client";
import { Clock, Mail, ShieldCheck } from "lucide-react";

export const metadata = { title: "Temporary email", description: "Free disposable email address: receive mail instantly without registration." };

export default async function PublicTempMailPage() {
  const cfg = await tempMailConfig();
  if (!cfg.enabled) notFound();
  const user = await currentUser();
  return (
    <>
      <Section className="pt-14 pb-8">
        <SectionTitle eyebrow="Temporary email" title="Disposable inbox, no sign-up" description={`Get a throwaway email address that receives mail for ${cfg.ttlMinutes} minutes. Perfect for one-time sign-ups and downloads.`} />
        {user ? (
          <div className="card p-6 max-w-lg mx-auto text-center"><p className="text-sm">You are logged in: manage your inboxes from the dashboard, where you can keep several addresses and pick custom names.</p><Link href="/dashboard/temp-mail" className="btn-primary mt-4">Open my inboxes</Link></div>
        ) : cfg.guests ? (
          <GuestTempMail domains={cfg.domains} />
        ) : (
          <div className="card p-6 max-w-lg mx-auto text-center"><p className="font-medium">Please log in to create a temporary inbox.</p><div className="flex justify-center gap-2 mt-4"><Link href="/login" className="btn-primary">Login</Link><Link href="/register" className="btn-secondary">Sign up</Link></div></div>
        )}
      </Section>
      <Section className="py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon={<Mail size={18} />} title="Instant delivery" description="Messages appear in your inbox within seconds, no refresh needed." />
          <FeatureCard icon={<Clock size={18} />} title="Auto-expiring" description="Inboxes and all their messages are deleted automatically after they expire. Extend them when you need more time." />
          <FeatureCard icon={<ShieldCheck size={18} />} title="Private" description="Only you hold the inbox link. Scripts and trackers are stripped from every message." />
        </div>
      </Section>
    </>
  );
}
