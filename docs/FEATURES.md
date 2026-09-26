# Feature checklist

Every feature of the original Premium URL Shortener (per its CodeCanyon listing and gempixel documentation) and where it lives here, followed by the extra premium features this edition adds.

## Parity with the original

| Feature | Location |
|---|---|
| URL shortening, random/custom aliases, premium (short) aliases, reserved aliases | `/`, `/dashboard/links/new`, `src/lib/links.ts` |
| Anonymous shortening with last-10 history | Home page (localStorage) |
| URL validation: format, blacklisted domains/keywords, same-domain loop, PhishTank, Google Web Risk, captcha, bot check | `validateUrl()` in `src/lib/links.ts`, `src/lib/captcha.ts` |
| Manual link approval (guests/users), verified users auto-approved | `links.approval*` settings, `/admin/links` |
| 5 redirection types: direct, frame (top bar, ad slot, share/close), splash (countdown, ads), custom splash (premium), overlay (CTA widgets) | `src/app/[alias]/render-link.tsx`, `/dashboard/splash`, `/dashboard/overlays` |
| Geo (country + state), device, language, time-of-day and advanced multi-condition targeting with documented priority | `chooseTarget()` in `src/lib/redirect.ts` |
| A/B split testing and link rotator modes | Link form → A/B section; campaigns rotator |
| Deep linking (manual + automatic conversion for 23 apps) | `src/lib/deeplinks.ts` |
| Custom meta tags (title/description/image) | Link form → Meta |
| Pixels: Facebook, Twitter/X, Bing, Google Ads, GTM, GA, Snapchat, Reddit, Quora, Pinterest, TikTok, LinkedIn, AdRoll, Hotjar, Clarity, Matomo, custom; bulk pixel assignment | `/dashboard/pixels`, `src/lib/pixels.ts` |
| UTM builder, custom parameters, parameter templates, dynamic parameter forwarding | Link form → Parameters, `/dashboard/parameters` |
| Password protection, expiration (date), click-expiration with custom redirect, custom expired URL | Link form → Protection |
| Cloaking, bot blocking, in-app browser breakout | Link form → Advanced |
| Link stats: clicks/unique, chart, hourly, countries, top cities, regions, referrers, browsers, OS, devices, languages, UTM, heatmap, recent clicks, CSV export, public stats (`/alias+`) | `/dashboard/links/[id]`, `/stats/[alias]` |
| System vs Google Analytics tracking method | `links.trackingMethod` setting |
| Archive, pin, duplicate, bulk actions, search/filters, CSV import (background jobs) and export | `/dashboard/links`, `/dashboard/import` |
| Channels (organize links, QR, bio; starred in sidebar) | `/dashboard/channels` |
| Campaigns with aggregated stats, shareable list page, link rotator | `/dashboard/campaigns`, `/campaign/[slug]`, `/{rotatorAlias}` |
| Custom domains (user), multiple domains (admin), root/404 redirects, DNS verification, domain check page | `/dashboard/domains`, `/admin/domains`, `/domain-check` |
| Bio pages: 50+ widgets (links, featured, media, socials, embeds, forms, newsletter, poll, FAQ, countdown, map, booking, music, Giphy, RSS, vCard, files, products, donations…), themes/animated themes, layouts, button styles incl. frosted, fonts, custom CSS/logo, branding removal, SEO, socials ordering/styles, password/age/sensitive/newsletter gating, block scheduling and country/language limits, templates, default bio page at `/u/username`, auto-save, per-block stats, submissions export, Mailchimp sync | `/dashboard/bio`, `src/components/bio`, `src/lib/bio-widgets.ts` |
| QR codes: 15 types (URL, text, email, phone, SMS, Wi-Fi, vCard w/ photo, location, event, app, crypto, WhatsApp, PayPal, link, bio), dynamic QR with scan tracking, dot/corner styles, gradients, logos, frames, templates, SVG/PNG/PDF, bulk generator, monthly limits, public generator | `/dashboard/qr`, `/qr-generator`, `src/lib/qr.ts` |
| Teams: invitations, multi-team membership, workspace switcher, per-module permissions | `/dashboard/teams`, `src/lib/workspace.ts` |
| Roles & permissions (custom admin roles) | `/admin/roles` |
| Verification system (document upload, badge, admin approval, 2FA reset requests) | Settings → Verification, `/admin/verifications` |
| Plans: monthly/yearly/lifetime pricing, every limit (links, monthly links, bio, QR, domains, campaigns, pixels, splash, overlays, team seats, API keys, AI credits, channels, files, storage, SMS), every feature toggle, trials, gateway sync | `/admin/plans`, `src/lib/plan.ts` |
| Coupons, bulk vouchers, tax rates by country/state, invoices | `/admin/coupons`, `/admin/taxes`, `/invoice/[id]` |
| Payment gateways: Stripe, PayPal, Paddle Billing, Paddle Classic, Paystack, Razorpay, Mollie, Crypto.com, CoinPayments, Midtrans, Lemon Squeezy, Iyzico, bank transfer; webhooks; subscriptions cancel/resume; refunds | `src/lib/payments/*`, `/api/webhooks/[gateway]`, `/admin/gateways` |
| Affiliate program (percent/fixed, first/recurring, min payout, code or username tags, payouts) | `/dashboard/affiliate`, `/admin/affiliates` |
| Social login (Google, Facebook, X), email verification, 2FA (app + email), login history, post-login redirect, social-only registration, Gravatar toggle, account deletion | `src/lib/auth.ts`, `/dashboard/settings` |
| Developer API (links, stats, account, campaigns, channels, pixels, domains, splash, overlays, QR, bio, files, teams, admin users/plans/payments), multiple API keys with permissions, rate limits, docs page, PHP/Node clients | `/api/v1/*`, `/developers`, `integrations/api-clients` |
| Zapier/custom webhooks (new link, click, bio view, QR scan), Slack slash command, Chrome extension, WordPress plugin, bookmarklet | `/dashboard/tools`, `/api/webhook/slack`, `integrations/` |
| AI Copilot (OpenAI / Gemini / Claude): slugs, bio page generation, click insights, metered credits + rate limits | `/dashboard/ai`, `src/lib/ai.ts` |
| Notifications dashboard, announcements bar, broadcast emails | `/dashboard/notifications`, `/admin/announcements` |
| CMS pages (multilingual), blog (categories, tags, author archives, bulk actions), help center with Q&A, testimonials (custom avatars), FAQ, contact form with spam check, abuse reports | `/admin/pages`, `/admin/blog`, `/admin/help`, `/contact`, `/report` |
| Admin settings for everything: general, links, users, captcha (reCAPTCHA v2/v3, hCaptcha, Turnstile, SolveMedia, Altcha), email providers (SMTP, Mailgun, SendGrid, Postmark, SES, Resend, Mailchimp), ads manager (7 slots, hidden for premium), storage/CDN (S3, Spaces, R2, B2, Wasabi, Vultr, Contabo + sync), cache, maintenance mode, private mode, custom code, multi-currency | `/admin/settings` |
| Language manager with in-app translation editor, packs import/export, `?lang=` + cookie, hreflang | `/admin/languages`, `src/lib/i18n.ts` |
| Themes: activate, settings (colors, scheme, homepage, menu), clone, child themes, code editor for CSS/JS/template overrides, 3 color schemes | `/admin/themes` |
| Plugins & marketplace (Helpdesk, File Hosting, Send SMS, payment plugins) | `/admin/plugins` |
| Helpdesk: tickets, categories, priorities, saved replies, attachments, ratings, staff assignment | `/dashboard/support`, `/admin/tickets` |
| File hosting: branded download pages, password, expiry, encryption, per-plan storage limits | `/dashboard/files`, `/{alias}` |
| Send SMS via Twilio with contacts, CSV import, auto-shortening, history | `/dashboard/sms` |
| Cron jobs (plan expiry, link expiry, cleanup, subscriptions, expiring notices, imports, AI credit reset, storage sync, backups) with admin runner and logs | `/api/cron/*`, `/admin/cron` |
| Sitemaps (pages, links, bio), robots, SEO settings, OG image | `/sitemap.xml`, `/sitemap-links.xml`, `/sitemap-bio.xml` |
| Keyboard quick shortener (Ctrl+K), dark mode, responsive UI, one-command install, Docker, updater page | Dashboard shell, `Dockerfile`, `/admin/update` |

## Extra premium features (not in the original)

1. Link health monitor with broken-link alerts and automatic fallback URLs (`/dashboard/health`, `/admin/health`).
2. Conversion tracking with embeddable script/pixel, goals, values and attribution (`/dashboard/links/[id]/conversions`, `public/conv.js`).
3. Real-time live analytics stream with map (`/dashboard/live`).
4. Scheduled weekly/monthly email performance digests.
5. Traffic threshold alerts and spike detection.
6. Shareable analytics reports with password/expiry and print-to-PDF (`/dashboard/reports`, `/share/[token]`).
7. Automatic metadata fetch and dynamic OG image generation (`/api/meta`, `/api/og`).
8. Tags with filtering and bulk tagging.
9. Link activation scheduling, per-link country/IP blocklists, expiry and go-live reminders.
10. Command palette (Ctrl/Cmd+K) with global search and quick actions.
11. Activity/audit log for users and admins (`/dashboard/activity`, `/admin/activity`).
12. Webhook delivery logs with retries/backoff and Discord, Telegram, Microsoft Teams providers.
13. Migration tool from Bitly, Rebrandly, TinyURL and Short.io exports (`/dashboard/migrate`).
14. Installable PWA with offline page and mobile share-target shortening.
15. White-label branding per custom domain (`/dashboard/domains/[id]/branding`).
16. Passwordless magic-link login, 2FA backup codes, admin login-as-user.
17. OpenAPI 3.1 spec and interactive API playground (`/api/v1/openapi.json`, `/developers/playground`).
18. Bulk QR ZIP downloads.

## Vendor add-ons (sold separately for the original, built in here)

| Add-on (original price) | Location |
|---|---|
| Temporary Email ($30) | `/dashboard/temp-mail`, public `/temp-mail`, inbound webhooks `/api/tempmail/inbound/[provider]`, `/admin/temp-mail` |
| Cloudflare SaaS SSL ($30) | `/admin/cloudflare`, automatic custom-hostname provisioning from `/dashboard/domains` |
| Helpdesk Platform ($30) | `/dashboard/support`, `/admin/tickets` |
| Chrome Extension ($30) | `integrations/chrome-extension` |
| File Hosting ($27) | `/dashboard/files` |
| SMS via Twilio ($27) | `/dashboard/sms` |
| Razorpay ($23), Crypto.com ($23), CoinPayments, Lemon Squeezy, Iyzico, Midtrans, MercadoPago | `src/lib/payments/*`, `/admin/gateways` |
| SaaS Theme ($22) with 5 color schemes + custom palette | `/admin/themes/saas`, `src/components/public/saas-home.tsx` |
| WordPress Plugin ($25) | `integrations/wordpress` |
| Email Validation (IPQualityScore), URLhaus Checker, Google Safe Browsing, Whitelist Domains, Ban IP Addresses, Block Countries, Restrict Emails, Block Emails, Block Search Engines, Registration Webhook, Mailchimp, No IP | `/admin/plugins` (toggle + configure), `src/lib/security.ts` |
| Bio Pages Directory | `/bio-pages` (opt-in per page in the bio builder) |
| Blog RSS Feed | `/blog/feed.xml` |
