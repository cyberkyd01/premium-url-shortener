import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { captchaFor } from "@/lib/social";
import { ContactForm } from "@/components/public/contact-form";
import { Mail, LifeBuoy, Flag } from "lucide-react";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with our team for support, sales or partnership inquiries." };

export default async function ContactPage() {
  const [s, user] = await Promise.all([getSettings(), currentUser()]);
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 grid gap-10 lg:grid-cols-[1fr_300px]">
      <div>
        <h1 className="text-3xl font-bold">Contact us</h1>
        <p className="text-muted mt-1 mb-6">Questions about plans, features or your account? Send us a message and we will reply by email.</p>
        <div className="card p-6"><ContactForm captcha={captchaFor(s, "onContact")} defaults={user ? { name: user.name || user.username, email: user.email } : undefined} /></div>
      </div>
      <aside className="space-y-4">
        <div className="card p-5"><div className="flex items-center gap-2 font-semibold mb-1"><Mail size={16} className="text-primary" /> Email</div><a href={`mailto:${s["site.email"]}`} className="text-sm text-primary">{s["site.email"]}</a></div>
        {s["help.enabled"] === "1" && <div className="card p-5"><div className="flex items-center gap-2 font-semibold mb-1"><LifeBuoy size={16} className="text-primary" /> Help center</div><p className="text-sm text-muted">Find answers to common questions in our <Link href="/help" className="text-primary">help center</Link>.</p></div>}
        <div className="card p-5"><div className="flex items-center gap-2 font-semibold mb-1"><Flag size={16} className="text-primary" /> Report abuse</div><p className="text-sm text-muted">Found a malicious link? <Link href="/report" className="text-primary">Report it</Link> and we will take action.</p></div>
      </aside>
    </div>
  );
}
