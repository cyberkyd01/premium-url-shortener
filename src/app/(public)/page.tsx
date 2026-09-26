import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { getUserPlan, ALL_REDIRECT_TYPES } from "@/lib/plan";
import { appHost, formatNumber } from "@/lib/utils";
import { toPricingPlan } from "@/lib/pricing";
import { captchaFor } from "@/lib/social";
import { ShortenerForm } from "@/components/public/shortener-form";
import { PricingGrid } from "@/components/public/pricing-grid";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { AdSlot } from "@/components/public/ad-slot";
import { Section, SectionTitle, FeatureCard } from "@/components/public/section";
import { SaasHome } from "@/components/public/saas-home";
import { BarChart3, Globe, Link2, Lock, Palette, QrCode, Share2, Shield, Star, Target, Users, Zap } from "lucide-react";

const HIGHLIGHTS = [
  { icon: <Link2 size={18} />, title: "Branded short links", description: "Custom aliases on your own domains. Memorable, trustworthy links that increase click-through rates." },
  { icon: <Target size={18} />, title: "Smart targeting", description: "Route visitors by country, device, language, time of day or any combination of rules. A/B test destinations." },
  { icon: <BarChart3 size={18} />, title: "Real-time analytics", description: "Clicks, unique visitors, referrers, geo heatmaps, devices and browsers, all in a clean dashboard." },
  { icon: <QrCode size={18} />, title: "Designer QR codes", description: "Dynamic, editable QR codes with logos, colors, frames and multiple content types." },
  { icon: <Palette size={18} />, title: "Bio pages", description: "Link-in-bio pages with dozens of widgets, themes, layouts and built-in forms." },
  { icon: <Share2 size={18} />, title: "Retargeting pixels", description: "Attach Facebook, Google, TikTok, LinkedIn and 10+ other pixels to build audiences from every click." },
  { icon: <Lock size={18} />, title: "Privacy & control", description: "Password protection, expiration dates, click limits and full ownership of your data." },
  { icon: <Users size={18} />, title: "Teams & API", description: "Invite teammates with granular roles. Automate with a REST API, Zapier, Slack and webhooks." },
];

export default async function HomePage() {
  const s = await getSettings();
  const user = await currentUser();
  const variant = s["site.homepage"] || "default";
  const isPrivate = s["site.private"] === "1" && !(user && (s["site.privateMode"] !== "admin" || user.role === "admin"));
  const [domains, linkCount, clickSum, userCount] = await Promise.all([
    db.domain.findMany({ where: { isPublic: true, status: 1 }, select: { id: true, domain: true }, orderBy: { domain: "asc" } }),
    db.link.count(),
    db.link.aggregate({ _sum: { clicks: true } }),
    db.user.count(),
  ]);
  const redirectTypes = user ? (user.role === "admin" ? ALL_REDIRECT_TYPES : (await getUserPlan(user.id)).features.redirectTypes) : ["direct"];
  const canShorten = !isPrivate && (user ? true : s["links.anonymous"] === "1");
  const showMarketing = variant !== "minimal";
  const [testimonials, faqs, plans] = showMarketing
    ? await Promise.all([
        s["testimonials.enabled"] === "1" ? db.testimonial.findMany({ where: { active: true }, orderBy: { order: "asc" }, take: 6 }) : Promise.resolve([]),
        db.faq.findMany({ where: { active: true }, orderBy: { order: "asc" }, take: 8 }),
        s["payments.enabled"] === "1" ? db.plan.findMany({ where: { isPublic: true }, orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }], take: 4 }) : Promise.resolve([]),
      ])
    : [[], [], []];
  const ads = s["ads.enabled"] === "1";
  const currency = s["payments.currency"] || s["site.currency"] || "USD";

  const heroForm = isPrivate ? (
            <div className="card p-6 max-w-lg mx-auto">
              <Shield size={28} className="mx-auto text-primary mb-2" />
              <p className="font-medium">This is a private service.</p>
              <p className="text-sm text-muted mt-1">Please log in to shorten links.</p>
              <div className="flex justify-center gap-2 mt-4"><Link href="/login" className="btn-primary">Login</Link>{s["users.registration"] === "1" && <Link href="/register" className="btn-secondary">Sign up</Link>}</div>
            </div>
          ) : canShorten ? (
            <ShortenerForm
              loggedIn={!!user}
              domains={domains}
              mainDomainUsable={s["domains.mainUsable"] === "1" || !user}
              mainHost={appHost()}
              allowCustomAlias={s["links.customAlias"] === "1" || !!user}
              redirectTypes={redirectTypes}
              captcha={user ? null : captchaFor(s, "onShorten")}
              history={s["links.anonymousHistory"] === "1"}
            />
          ) : (
            <div className="card p-6 max-w-lg mx-auto">
              <p className="font-medium">Create a free account to start shortening links.</p>
              <div className="flex justify-center gap-2 mt-4"><Link href="/register" className="btn-primary">Get started</Link><Link href="/login" className="btn-secondary">Login</Link></div>
            </div>
          );

  if (variant === "saas") {
    return (
      <SaasHome
        siteName={s["site.name"]} tagline={s["site.tagline"] || "Shorten, brand, track and share smart links"} description={s["site.description"]}
        loggedIn={!!user} registration={s["users.registration"] === "1"} hero={heroForm} mainHost={appHost()}
        stats={{ links: linkCount, clicks: clickSum._sum.clicks ?? 0, users: userCount }}
        testimonials={testimonials.map((t) => ({ id: t.id, name: t.name, role: t.role, avatar: t.avatar, content: t.content, rating: t.rating }))}
        faqs={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))}
        plans={plans.map(toPricingPlan)} currency={currency}
      />
    );
  }

  const hero = (
    <section className={variant === "landing" ? "relative overflow-hidden bg-gradient-to-b from-primary/10 via-bg to-bg" : ""}>
      <div className={`max-w-6xl mx-auto px-4 text-center ${variant === "landing" ? "pt-20 pb-16" : "pt-14 pb-10"}`}>
        {variant === "landing" && <span className="badge-blue mb-4 inline-flex">New: AI copilot, bio widgets and dynamic QR codes</span>}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto">{s["site.tagline"] || "Shorten, brand, track and share smart links"}</h1>
        <p className="text-muted text-lg mt-4 max-w-2xl mx-auto">{s["site.description"]}</p>
        <div className="mt-8">{heroForm}</div>
        {ads && <AdSlot code={s["ads.sidebar"]} className="mt-8 flex justify-center" />}
        {variant !== "minimal" && (
          <p className="text-xs text-muted mt-6">By using our service you accept our terms. Free links are subject to our abuse policy. <Link href="/report" className="underline">Report abuse</Link></p>
        )}
      </div>
    </section>
  );

  if (!showMarketing) return hero;

  return (
    <>
      {hero}
      <Section className="py-10">
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
          {[
            { label: "Links created", value: formatNumber(linkCount) },
            { label: "Clicks tracked", value: formatNumber(clickSum._sum.clicks ?? 0) },
            { label: "Happy users", value: formatNumber(userCount) },
          ].map((st) => <div key={st.label} className="card p-5"><p className="text-3xl font-bold text-primary">{st.value}</p><p className="text-xs text-muted mt-1 uppercase tracking-wide">{st.label}</p></div>)}
        </div>
      </Section>
      <Section id="features">
        <SectionTitle eyebrow="Features" title="Everything you need to manage links" description="One platform for short links, QR codes, bio pages, retargeting and analytics." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{HIGHLIGHTS.map((h) => <FeatureCard key={h.title} {...h} />)}</div>
        <div className="text-center mt-8"><Link href="/features" className="btn-secondary">Explore all features</Link></div>
      </Section>
      {variant === "landing" && (
        <Section className="py-10">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Zap size={18} />, title: "1. Paste", text: "Drop any long URL into the box above or use the API, bookmarklet, browser extension or Slack." },
              { icon: <Globe size={18} />, title: "2. Customize", text: "Pick a domain and alias, add targeting rules, pixels, a splash page or an overlay." },
              { icon: <BarChart3 size={18} />, title: "3. Share & measure", text: "Share everywhere and watch real-time analytics, or generate a matching QR code." },
            ].map((st) => <FeatureCard key={st.title} icon={st.icon} title={st.title} description={st.text} />)}
          </div>
        </Section>
      )}
      {testimonials.length > 0 && (
        <Section>
          <SectionTitle eyebrow="Testimonials" title="Loved by marketers, creators and teams" />
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="card p-5">
                <div className="flex gap-0.5 text-warning mb-3">{Array.from({ length: Math.max(1, Math.min(5, t.rating)) }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                <blockquote className="text-sm leading-6">{t.content}</blockquote>
                <figcaption className="flex items-center gap-3 mt-4">
                  {t.avatar ? <img src={t.avatar} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold">{t.name.charAt(0)}</span>}
                  <div><p className="text-sm font-medium">{t.name}</p>{t.role && <p className="text-xs text-muted">{t.role}</p>}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}
      {plans.length > 0 && (
        <Section id="pricing">
          <SectionTitle eyebrow="Pricing" title="Simple, transparent pricing" description="Start for free. Upgrade for custom domains, advanced targeting, teams and more." />
          <PricingGrid plans={plans.map(toPricingPlan)} currency={currency} loggedIn={!!user} teaser />
          <div className="text-center mt-8"><Link href="/pricing" className="btn-secondary">Compare all plans</Link></div>
        </Section>
      )}
      {faqs.length > 0 && (
        <Section>
          <SectionTitle eyebrow="FAQ" title="Frequently asked questions" />
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
      <Section>
        <div className="card p-8 md:p-12 text-center bg-gradient-to-br from-primary/10 to-accent/10">
          <h2 className="text-3xl font-bold">Ready to take control of your links?</h2>
          <p className="text-muted mt-2 max-w-xl mx-auto">Join {formatNumber(userCount)} users who shorten, brand and track links with {s["site.name"]}.</p>
          <div className="flex justify-center gap-3 mt-6">
            {user ? <Link href="/dashboard" className="btn-primary">Go to dashboard</Link> : <><Link href="/register" className="btn-primary">Create free account</Link><Link href="/pricing" className="btn-secondary">See pricing</Link></>}
          </div>
          <div className="mt-10">
            <p className="text-sm font-medium mb-3">Get product updates and tips in your inbox</p>
            <NewsletterForm />
          </div>
        </div>
      </Section>
    </>
  );
}
