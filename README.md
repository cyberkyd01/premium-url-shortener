# Premium URL Shortener (Next.js edition)

A complete, self-hosted URL shortener SaaS with the full feature set of the commercial "Premium URL Shortener" script:
short links with advanced targeting, bio pages, QR codes, splash & overlay pages, campaigns & channels, pixels, teams
& roles, membership plans with 13 payment gateways, affiliates, CMS/blog/help center, admin panel, REST API, Zapier,
Slack, Chrome extension, WordPress plugin, AI Copilot, file hosting and SMS.

> **Deploying to a server?** Follow the step-by-step VPS guide: **[DEPLOY.md](DEPLOY.md)**

## Quick start

```bash
cp .env.example .env           # set AUTH_SECRET, APP_URL, mail/payment keys
pnpm install
pnpm prisma db push            # creates prisma/dev.db (SQLite)
pnpm db:seed                   # plans, admin user, templates, languages, themes
pnpm dev                       # http://localhost:3000
```

Default admin: `admin@example.com` / `admin1234` (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding).

### Production

For a step-by-step VPS setup (isolated Node runtime, systemd service, cron timer, nginx + HTTPS, backups, rollback) follow **[DEPLOY.md](DEPLOY.md)**.

```bash
pnpm build && pnpm start
# or
docker compose up -d
```

Cron jobs: point a scheduler at the URLs listed in **Admin → Cron Jobs** (or run `pnpm cron` every 10 minutes).

### Database

SQLite is the default. For MySQL or PostgreSQL change `provider` in `prisma/schema.prisma` and `DATABASE_URL`, then
run `pnpm prisma db push`.

## Feature map

| Area | Where |
|------|-------|
| Short links, targeting, redirect types, stats | `/dashboard/links`, engine in `src/lib/redirect.ts`, `src/app/[alias]` |
| Channels, campaigns & rotator, pixels, domains, splash pages, overlays | `/dashboard/*` |
| Bio pages (all widgets), QR codes (styles, frames, dynamic, bulk) | `/dashboard/bio`, `/dashboard/qr`, public `/qr-generator` |
| Teams & permissions, account settings, 2FA, API keys, verification | `/dashboard/teams`, `/dashboard/settings` |
| Plans, checkout, coupons, vouchers, taxes, invoices, gateways | `/pricing`, `/checkout`, `/dashboard/billing`, `src/lib/payments` |
| Affiliates, helpdesk tickets, file hosting, SMS, AI Copilot, integrations | `/dashboard/affiliate`, `/support`, `/files`, `/sms`, `/ai`, `/tools` |
| Admin panel (users, roles, settings, languages, themes, plugins, content, payments, cron, tools) | `/admin` |
| Public site (home, features, pricing, blog, help center, pages, contact, report, stats) | `src/app/(public)` |
| REST API v1 + docs | `/api/v1/*`, `/developers`, `docs/API.md` |
| Cron endpoints | `/api/cron/*` |
| Integrations (WordPress plugin, Chrome extension, API clients, bookmarklet) | `integrations/`, `public/bookmarklet.js` |

See `docs/FEATURES.md` for the complete feature checklist (parity with the original plus 18 extra premium features), `docs/API.md` for the REST API, and `docs/ARCHITECTURE.md` for code conventions.
