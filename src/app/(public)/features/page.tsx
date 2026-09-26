import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Section, SectionTitle, FeatureCard } from "@/components/public/section";
import { Check } from "lucide-react";

export const metadata: Metadata = { title: "Features", description: "Explore every feature: branded short links, targeting, QR codes, bio pages, pixels, analytics, teams, API and integrations." };

const GROUPS: { title: string; description: string; items: { title: string; description: string }[] }[] = [
  {
    title: "Short links that work harder",
    description: "Create links in seconds, then shape exactly how and where they redirect.",
    items: [
      { title: "Short links", description: "Instantly turn long URLs into short, shareable links on the main domain or your own." },
      { title: "Custom aliases", description: "Choose memorable aliases like /summer-sale. Premium ultra-short aliases for paid plans." },
      { title: "Branded custom domains", description: "Connect unlimited domains with a simple A/CNAME record, including root and 404 redirects." },
      { title: "Password protection", description: "Require a password before visitors can access the destination." },
      { title: "Expiration", description: "Expire links on a date or after a number of clicks, optionally sending visitors to a fallback URL." },
      { title: "Click limits", description: "Cap the number of clicks a link can receive; perfect for limited offers." },
      { title: "Link cloaking & bot blocking", description: "Hide destinations from scrapers and keep bots out of your statistics." },
      { title: "In-app browser breakout", description: "Escape Instagram, Facebook and TikTok in-app browsers so deep links and payments work." },
      { title: "Bulk import & export", description: "Import links from CSV, export links and statistics whenever you need them." },
    ],
  },
  {
    title: "Targeting and routing",
    description: "Send every visitor to the right destination, automatically.",
    items: [
      { title: "Geo targeting", description: "Redirect by country or state/region with per-destination rules." },
      { title: "Device targeting", description: "Different destinations for desktop, mobile and tablet visitors." },
      { title: "Language targeting", description: "Match the visitor's browser language to localized landing pages." },
      { title: "Time targeting", description: "Schedule destinations by hours, weekdays and timezone." },
      { title: "Advanced targeting rules", description: "Combine conditions (country + device + referrer + parameters) with all/any matching." },
      { title: "A/B testing & rotator", description: "Split traffic between multiple URLs with weights, sequential or random rotation." },
      { title: "Deep links", description: "Open iOS and Android apps directly with store fallbacks and universal link support." },
      { title: "UTM builder & parameters", description: "Add UTM tags and custom parameters with reusable parameter templates." },
      { title: "Parameter forwarding", description: "Pass query parameters from the short link through to the destination." },
    ],
  },
  {
    title: "Five redirection types",
    description: "Choose how the visitor experiences the redirect.",
    items: [
      { title: "Direct", description: "Instant 301/302 redirect to the destination." },
      { title: "Frame", description: "Show the destination inside a frame with your header, branding and ads." },
      { title: "Splash", description: "Interstitial page with countdown, preview and optional advertising." },
      { title: "Custom splash", description: "Fully branded splash pages with logo, colors, custom CSS/HTML and countdown." },
      { title: "Overlay", description: "Display a message, contact form, poll, newsletter, coupon, image, video or CTA over the destination." },
    ],
  },
  {
    title: "Retargeting pixels",
    description: "Build audiences from every click with 15+ providers.",
    items: [
      { title: "Advertising pixels", description: "Facebook, Google Ads, Google Analytics, Google Tag Manager, Twitter/X, Bing, TikTok, Snapchat, Pinterest, Reddit, Quora, LinkedIn, AdRoll." },
      { title: "Analytics & heatmaps", description: "Hotjar, Microsoft Clarity, Matomo and custom scripts." },
      { title: "Per-link and per-bio pixels", description: "Attach multiple pixels to any link or bio page in one click." },
    ],
  },
  {
    title: "Bio pages",
    description: "A beautiful link-in-bio page with dozens of widgets.",
    items: [
      { title: "50+ widgets", description: "Links, headings, images, galleries, carousels, YouTube, Vimeo, Spotify, TikTok, Twitter, Instagram, maps, Calendly, Typeform, PayPal, products, vCards, files, FAQ, polls, countdowns, RSS and more." },
      { title: "Themes & layouts", description: "Templates, gradients, fonts, button styles, animations, custom CSS and custom logo." },
      { title: "Forms & gating", description: "Contact forms, newsletter capture, password, age and NSFW gates." },
      { title: "Scheduling & targeting", description: "Schedule blocks and limit them by country or language." },
      { title: "Custom domains & SEO", description: "Serve bio pages on your own domain with full SEO control and a verified badge." },
    ],
  },
  {
    title: "QR codes",
    description: "Dynamic, on-brand QR codes for print and screen.",
    items: [
      { title: "15 content types", description: "URL, text, email, phone, SMS, Wi-Fi, vCard, location, event, app, crypto, WhatsApp, PayPal, link and bio." },
      { title: "Styles, frames & logos", description: "Dot and eye shapes, gradients, colors, frames with call-to-action text and embedded logos." },
      { title: "Dynamic & trackable", description: "Change the destination anytime and track scans by location and device." },
      { title: "Bulk generation", description: "Generate QR codes in bulk and download as SVG, PNG or PDF." },
    ],
  },
  {
    title: "Organization and collaboration",
    description: "Keep growing accounts tidy and work together.",
    items: [
      { title: "Campaigns & channels", description: "Group links, bio pages and QR codes; public campaign pages; campaign rotators." },
      { title: "Teams & roles", description: "Invite teammates with granular permissions for links, bio pages, QR codes, domains and more." },
      { title: "Notes, pins & archive", description: "Annotate, pin important links and archive old ones." },
    ],
  },
  {
    title: "Analytics",
    description: "Understand who clicks and why.",
    items: [
      { title: "Real-time dashboard", description: "Clicks and unique visitors by day and hour with instant updates." },
      { title: "Geo heatmap", description: "Countries, regions and cities on an interactive map." },
      { title: "Devices, browsers & OS", description: "Know what your audience uses so you can optimize landing pages." },
      { title: "Referrers & UTM", description: "See which sites and campaigns send traffic, plus per-destination performance for A/B tests." },
      { title: "Public stats pages", description: "Optionally share statistics with anyone via a public link." },
    ],
  },
  {
    title: "Automation and integrations",
    description: "Fit the shortener into your existing workflow.",
    items: [
      { title: "REST API", description: "Full API for links, bio pages, QR codes, campaigns, domains and statistics with per-key permissions." },
      { title: "Zapier & webhooks", description: "Trigger zaps or your own endpoints when links are created or clicked." },
      { title: "Slack", description: "Shorten links from Slack with a slash command." },
      { title: "Chrome extension", description: "Shorten the current tab, pick a domain and copy in one click." },
      { title: "WordPress plugin", description: "Automatically shorten posts and insert short links from the editor." },
      { title: "Bookmarklet", description: "One-click shortening from any browser." },
    ],
  },
  {
    title: "More",
    description: "Extra tools included with your account.",
    items: [
      { title: "AI copilot", description: "Generate aliases, bio page content and analytics insights with AI." },
      { title: "File hosting", description: "Upload files and share them via short links with optional passwords and expiration." },
      { title: "SMS sending", description: "Send short links by SMS to contacts through your Twilio account." },
      { title: "Splash & overlay builders", description: "Design branded interstitial pages and overlays without code." },
      { title: "Security", description: "Two-factor authentication, login history, URL filtering, phishing and malware checks." },
    ],
  },
];

export default async function FeaturesPage() {
  const s = await getSettings();
  return (
    <>
      <Section className="pb-6">
        <SectionTitle eyebrow="Features" title={`Everything ${s["site.name"]} can do`} description="A complete toolkit for short links, targeting, QR codes, bio pages, retargeting, analytics and automation." />
      </Section>
      {GROUPS.map((g) => (
        <Section key={g.title} className="py-8">
          <div className="mb-6"><h2 className="text-2xl font-bold">{g.title}</h2><p className="text-muted mt-1">{g.description}</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{g.items.map((it) => <FeatureCard key={it.title} icon={<Check size={18} />} title={it.title} description={it.description} />)}</div>
        </Section>
      ))}
      <Section>
        <div className="card p-8 text-center bg-primary/5">
          <h2 className="text-2xl font-bold">Try it free today</h2>
          <p className="text-muted mt-2">No credit card required. Upgrade whenever you need more.</p>
          <div className="flex justify-center gap-3 mt-6"><Link href="/register" className="btn-primary">Create account</Link><Link href="/pricing" className="btn-secondary">View pricing</Link></div>
        </div>
      </Section>
    </>
  );
}
