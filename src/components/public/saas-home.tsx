import type { ReactNode } from "react";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";
import { PricingGrid, type PricingPlan } from "@/components/public/pricing-grid";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { Section, SectionTitle } from "@/components/public/section";
import { ArrowRight, BarChart3, Check, Globe, Link2, Lock, MousePointerClick, Palette, QrCode, Share2, Sparkles, Star, Target, Users, Zap } from "lucide-react";

export interface SaasHomeProps {
  siteName: string;
  tagline: string;
  description: string;
  loggedIn: boolean;
  registration: boolean;
  /** The shortener form / private notice rendered inside the hero. */
  hero: ReactNode;
  stats: { links: number; clicks: number; users: number };
  testimonials: { id: string; name: string; role: string | null; avatar: string | null; content: string; rating: number }[];
  faqs: { id: string; question: string; answer: string }[];
  plans: PricingPlan[];
  currency: string;
  mainHost: string;
}

const FEATURES = [
  { icon: <Link2 size={18} />, title: "Branded short links", text: "Custom aliases on your own domains with automatic SSL. Links people trust and remember." },
  { icon: <Target size={18} />, title: "Smart targeting", text: "Route by country, device, language or time. Rotate destinations and A/B test in one click." },
  { icon: <BarChart3 size={18} />, title: "Real-time analytics", text: "Clicks, unique visitors, referrers, devices and geo heatmaps, live as they happen." },
  { icon: <QrCode size={18} />, title: "Dynamic QR codes", text: "Editable QR codes with logos, colors and frames. Change the destination without reprinting." },
  { icon: <Palette size={18} />, title: "Link-in-bio pages", text: "Beautiful bio pages with dozens of widgets, forms, themes and your own domain." },
  { icon: <Share2 size={18} />, title: "Retargeting pixels", text: "Attach Meta, Google, TikTok, LinkedIn and more to build audiences from every click." },
  { icon: <Lock size={18} />, title: "Privacy & control", text: "Passwords, expiry dates, click limits, cloaking and a full audit trail." },
  { icon: <Users size={18} />, title: "Teams & API", text: "Granular team roles, REST API, Zapier, Slack, webhooks and a browser extension." },
];

const STEPS = [
  { icon: <Zap size={18} />, title: "Paste", text: "Drop a long URL into the box, use the API, the bookmarklet or the browser extension." },
  { icon: <Globe size={18} />, title: "Customize", text: "Pick a domain and alias, add targeting rules, pixels, a splash page or an overlay." },
  { icon: <MousePointerClick size={18} />, title: "Share & measure", text: "Share anywhere and watch clicks roll in with real-time analytics and reports." },
];

const LOGOS = ["Northwind", "Acme Corp", "Globex", "Initech", "Umbrella", "Hooli", "Vandelay", "Stark"];

function Mockup({ host }: { host: string }) {
  const rows = [
    { alias: "launch", clicks: 12840, w: "92%" }, { alias: "spring-sale", clicks: 8421, w: "64%" }, { alias: "podcast", clicks: 5310, w: "41%" }, { alias: "webinar", clicks: 2977, w: "23%" },
  ];
  const bars = [32, 48, 40, 66, 58, 84, 72, 96, 80, 62, 90, 100];
  return (
    <div className="relative">
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary/25 via-accent/15 to-transparent blur-2xl rounded-full" aria-hidden />
      <div className="relative card overflow-hidden shadow-2xl border-border/80">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-bg/60">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" /><span className="h-2.5 w-2.5 rounded-full bg-warning/70" /><span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="ml-3 text-[11px] text-muted font-mono truncate">{host}/dashboard</span>
        </div>
        <div className="p-4 grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[{ l: "Clicks today", v: "4,812", d: "+18%" }, { l: "Unique", v: "3,240", d: "+11%" }, { l: "Top country", v: "US", d: "42%" }].map((k) => (
              <div key={k.l} className="rounded-lg border border-border p-3"><p className="text-[10px] uppercase tracking-wide text-muted">{k.l}</p><p className="text-lg font-bold leading-tight">{k.v}</p><p className="text-[10px] text-success">{k.d}</p></div>
            ))}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted mb-2">Clicks · last 12 days</p>
            <div className="flex items-end gap-1 h-20">{bars.map((h, i) => <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-primary to-accent opacity-90" style={{ height: `${h}%` }} />)}</div>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {rows.map((r) => (
              <div key={r.alias} className="flex items-center gap-3 px-3 py-2 text-xs">
                <Link2 size={12} className="text-primary shrink-0" /><span className="font-mono truncate">{host}/{r.alias}</span>
                <span className="flex-1 h-1.5 rounded bg-border overflow-hidden"><span className="block h-full bg-primary" style={{ width: r.w }} /></span>
                <span className="text-muted tabular-nums">{formatNumber(r.clicks)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 card px-3 py-2 shadow-xl flex items-center gap-2 text-xs animate-in"><span className="h-6 w-6 rounded-full bg-success/15 text-success grid place-items-center"><Check size={12} /></span>SSL issued for <span className="font-mono">go.acme.co</span></div>
      <div className="absolute -top-4 -right-3 card px-3 py-2 shadow-xl flex items-center gap-2 text-xs"><QrCode size={14} className="text-primary" />QR scanned · Berlin</div>
    </div>
  );
}

/** SaaS theme landing page. */
export function SaasHome(p: SaasHomeProps) {
  const cta = p.loggedIn ? <Link href="/dashboard" className="btn-primary">Go to dashboard <ArrowRight size={16} /></Link> : <><Link href={p.registration ? "/register" : "/login"} className="btn-primary">Start for free <ArrowRight size={16} /></Link><Link href="/features" className="btn-secondary">See all features</Link></>;
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at top left, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%), radial-gradient(ellipse at bottom right, color-mix(in srgb, var(--accent) 14%, transparent), transparent 55%)" }} aria-hidden />
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="badge-blue inline-flex items-center gap-1 mb-5"><Sparkles size={12} />New: AI copilot, bio widgets and dynamic QR codes</span>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">{p.tagline}</h1>
            <p className="text-muted text-lg mt-5 max-w-xl">{p.description}</p>
            <div className="flex flex-wrap gap-3 mt-7">{cta}</div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-sm text-muted">{["Free plan forever", "No credit card", "Cancel anytime"].map((t) => <li key={t} className="inline-flex items-center gap-1.5"><Check size={14} className="text-success" />{t}</li>)}</ul>
            <div className="mt-8 text-left">{p.hero}</div>
          </div>
          <div className="hidden lg:block pl-6"><Mockup host={p.mainHost} /></div>
        </div>
      </section>

      {/* Logos */}
      <section className="border-y border-border bg-card/40">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-center text-xs uppercase tracking-wider text-muted mb-5">Trusted by marketing teams, creators and agencies worldwide</p>
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">{LOGOS.map((l) => <span key={l} className="text-lg font-bold tracking-tight text-muted/70 select-none">{l}</span>)}</div>
        </div>
      </section>

      {/* Features */}
      <Section id="features">
        <SectionTitle eyebrow="Everything in one place" title="One platform for every link you share" description="Short links, QR codes, bio pages, retargeting and analytics, built for teams that ship fast." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group card p-5 h-full transition hover:-translate-y-0.5 hover:border-primary/50">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-fg grid place-items-center mb-4 shadow-md">{f.icon}</div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted leading-6">{f.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <section className="bg-card/40 border-y border-border">
        <Section className="py-16">
          <SectionTitle eyebrow="How it works" title="From long URL to insight in three steps" />
          <ol className="grid md:grid-cols-3 gap-6 relative">
            {STEPS.map((st, i) => (
              <li key={st.title} className="card p-6 relative">
                <span className="absolute -top-3 left-6 h-7 w-7 rounded-full bg-primary text-primary-fg text-xs font-bold grid place-items-center shadow">{i + 1}</span>
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3 mt-2">{st.icon}</div>
                <h3 className="font-semibold">{st.title}</h3>
                <p className="text-sm text-muted mt-1 leading-6">{st.text}</p>
              </li>
            ))}
          </ol>
        </Section>
      </section>

      {/* Stats band */}
      <section className="bg-gradient-to-r from-primary to-accent text-primary-fg">
        <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: formatNumber(p.stats.links), l: "Links created" }, { v: formatNumber(p.stats.clicks), l: "Clicks tracked" }, { v: formatNumber(p.stats.users), l: "Happy users" }, { v: "99.9%", l: "Uptime" },
          ].map((k) => <div key={k.l}><p className="text-3xl md:text-4xl font-extrabold">{k.v}</p><p className="text-xs uppercase tracking-wide opacity-80 mt-1">{k.l}</p></div>)}
        </div>
      </section>

      {/* Pricing */}
      {p.plans.length > 0 && (
        <Section id="pricing">
          <SectionTitle eyebrow="Pricing" title="Plans that grow with you" description="Start free. Upgrade for custom domains, advanced targeting, teams and more." />
          <PricingGrid plans={p.plans} currency={p.currency} loggedIn={p.loggedIn} teaser />
          <div className="text-center mt-8"><Link href="/pricing" className="btn-secondary">Compare all plans</Link></div>
        </Section>
      )}

      {/* Testimonials */}
      {p.testimonials.length > 0 && (
        <section className="bg-card/40 border-y border-border">
          <Section className="py-16">
            <SectionTitle eyebrow="Testimonials" title="Loved by marketers, creators and teams" />
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:mx-0 md:px-0">
              {p.testimonials.map((t) => (
                <figure key={t.id} className="card p-6 min-w-[85%] sm:min-w-[60%] md:min-w-0 snap-center flex flex-col">
                  <div className="flex gap-0.5 text-warning mb-3">{Array.from({ length: Math.max(1, Math.min(5, t.rating)) }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</div>
                  <blockquote className="text-sm leading-6 flex-1">&ldquo;{t.content}&rdquo;</blockquote>
                  <figcaption className="flex items-center gap-3 mt-5">
                    {t.avatar ? <img src={t.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent text-primary-fg grid place-items-center font-semibold">{t.name.charAt(0)}</span>}
                    <div><p className="text-sm font-medium">{t.name}</p>{t.role && <p className="text-xs text-muted">{t.role}</p>}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Section>
        </section>
      )}

      {/* FAQ */}
      {p.faqs.length > 0 && (
        <Section>
          <SectionTitle eyebrow="FAQ" title="Frequently asked questions" />
          <div className="max-w-3xl mx-auto space-y-3">
            {p.faqs.map((f) => (
              <details key={f.id} className="group card px-5 py-4 open:border-primary/50">
                <summary className="font-medium cursor-pointer list-none flex justify-between items-center gap-4">{f.question}<span className="h-6 w-6 rounded-full border border-border grid place-items-center text-muted group-open:rotate-45 group-open:text-primary group-open:border-primary transition shrink-0">+</span></summary>
                <div className="text-sm text-muted mt-3 prose-content" dangerouslySetInnerHTML={{ __html: f.answer }} />
              </details>
            ))}
          </div>
        </Section>
      )}

      {/* CTA */}
      <Section>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-primary-fg p-10 md:p-16 text-center shadow-2xl">
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 20%, #fff, transparent 40%), radial-gradient(circle at 80% 80%, #fff, transparent 40%)" }} aria-hidden />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Ready to take control of your links?</h2>
            <p className="mt-3 max-w-xl mx-auto opacity-90">Join {formatNumber(p.stats.users)} users who shorten, brand and track links with {p.siteName}.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-7">
              {p.loggedIn ? <Link href="/dashboard" className="btn-secondary">Go to dashboard</Link> : <><Link href={p.registration ? "/register" : "/login"} className="btn-secondary">Create free account</Link><Link href="/pricing" className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10">See pricing</Link></>}
            </div>
            <div className="mt-10 max-w-md mx-auto text-fg"><p className="text-sm font-medium mb-3 text-primary-fg">Get product updates and tips in your inbox</p><NewsletterForm /></div>
          </div>
        </div>
      </Section>
    </>
  );
}
