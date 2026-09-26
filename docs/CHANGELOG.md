# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses semantic versioning.

## [1.0.0] — 2026-09-25

Initial release: a full-featured URL shortener SaaS built with Next.js 15, React 19, Prisma and Tailwind v4.

### Links
- Short links with custom aliases, premium (short) aliases, custom domains and reserved-alias protection.
- Redirect types: direct, frame, splash, custom splash pages, overlays.
- Targeting: geo (country/state), device/OS, language, time windows, advanced multi-condition rules, A/B testing and rotators.
- Deep links (iOS/Android/fallback), in-app browser breakout, link cloaking, bot blocking.
- Password protection, expiration (with fallback URL), click limits, UTM builder, custom parameters, parameter templates, parameter forwarding.
- Retargeting pixels (Facebook, Google Ads, GTM, GA, TikTok, LinkedIn, Snapchat, Pinterest, Reddit, Quora, Bing, Twitter, AdRoll, Hotjar, Clarity, Matomo, custom).
- Custom meta tags (title, description, image), notes, pinning, archiving, public/private stats.
- URL filtering: blocked domains/words, same-domain loop protection, Google Web Risk, PhishTank; manual approval queues.
- Campaigns with public campaign pages and link rotators; channels to organize links, bio pages and QR codes.
- CSV import (background job) and export.

### Analytics
- Real-time click tracking with unique visitors, countries, regions, cities, referrers, browsers, OS, devices, languages, UTM breakdown, target URLs, heatmap coordinates and hourly distribution.
- Configurable retention per plan, anonymous stats mode, Google Analytics tracking mode.
- Public stats pages, campaign and dashboard overviews, recent clicks tables.

### Bio pages
- Drag-and-drop bio pages with 60+ block types (links, media embeds, socials, forms, newsletter, polls, countdown, maps, booking, products, PayPal/donations, files, HTML, …).
- Themes, layouts, button styles, fonts, colors, custom CSS/logo, SEO settings, social icons.
- Password / age gate / newsletter gate, sensitive content warning, scheduled and geo/language-limited blocks, submissions inbox.
- Templates, default profile at `/u/{username}`, custom domains.

### QR codes
- Static and dynamic (trackable, editable) QR codes for URL, text, email, phone, SMS, Wi-Fi, vCard, location, event, app, crypto, WhatsApp, PayPal, short link and bio page.
- Advanced styling: dot/corner shapes, gradients, logos, frames with text, templates; SVG/PNG/JPG/WebP/PDF downloads, bulk generation.

### Accounts, plans & payments
- Email/password and social login (Google, Facebook, Twitter/X), email verification, 2FA (app & email), login history, verified badges, public accounts.
- Plans with per-feature flags and limits (links, monthly links, bio pages, QR codes, domains, campaigns, pixels, splash pages, overlays, team members, API keys, AI credits, files, storage, SMS), trials, coupons and vouchers, taxes, invoices.
- Payment gateways: Stripe, PayPal, Paddle, Paystack, Razorpay, Mollie, CoinPayments, Crypto.com, Lemon Squeezy, iyzico, Midtrans and bank transfer; subscriptions with grace-period downgrades.
- Affiliate program with commissions, payouts and referral tracking.
- Teams with granular member permissions and workspace switching.

### Platform
- Admin panel: users & roles, links moderation, domains, plans, payments, affiliates, settings, languages, themes & theme editor, pages, blog, help center, testimonials/FAQ, ads, abuse reports, verification requests, tools, plugins, notifications.
- CMS: pages, blog with categories, help center, announcements, contact form, newsletter subscribers.
- i18n with translatable strings and languages, RTL support, localized URLs & hreflang.
- Email templates (SMTP, Mailgun, SendGrid, Postmark, SES, Resend, Mailchimp), captcha providers (reCAPTCHA v2/v3, hCaptcha, Turnstile, SolveMedia, Altcha), storage drivers (local, S3-compatible), cache drivers.
- AI Copilot (OpenAI, Gemini, Anthropic) for slugs, bio copy and insights with monthly credits.
- Plugins: Helpdesk tickets, File hosting, Send SMS (Twilio).

### Developer API & integrations
- REST API v1 (`/api/v1`) with API keys, per-key permissions, rate limits, consistent envelopes and pagination: account, links (+bulk, stats, clicks, archive), campaigns, channels, pixels, domains, splash pages, overlays, QR codes, bio pages & blocks, files, teams, and admin endpoints for users, plans and payments. Legacy aliases `/api/v1/urls`, `/api/v1/url`, `/api/v1/stats/:id`.
- Public quick endpoints: `POST|GET /api/shorten` (session / API key / anonymous with captcha & IP rate limit), `GET /api/unshorten`.
- Webhooks for Zapier and custom endpoints (`link.created`, `link.clicked`, `bio.viewed`, `qr.scanned`, `link.updated`, `link.deleted`) with HMAC signatures.
- Slack slash command (`/shorten`) with signing-secret verification.
- `/developers` documentation page and `docs/API.md`.
- Integrations folder: WordPress plugin, Chrome extension (Manifest V3), PHP and Node.js API clients, Zapier guide, bookmarklet.
- Cron jobs (`/api/cron/*` + `scripts/cron.ts`): plan expiry, link expiry, cleanup, subscriptions, expiry reminders, CSV imports, AI credit reset, storage sync, JSON backups.
- Docker: multi-stage `Dockerfile`, `docker-compose.yml` with cron sidecar and optional MySQL.
