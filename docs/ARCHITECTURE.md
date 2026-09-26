# Architecture & conventions

Stack: Next.js 15 (App Router, React 19, TypeScript strict), Tailwind v4 (`src/app/globals.css` has utility classes: `card`, `btn-primary|secondary|danger|ghost`, `btn-sm`, `input`, `label`, `hint`, `badge-*`, `table`, `nav-item`, `prose-content`), Prisma 6 + SQLite (swap provider for MySQL/Postgres), Auth.js v5 (JWT sessions; credentials + Google/Facebook/Twitter), lucide-react icons, recharts.

## Directory ownership
- `src/lib/*` shared services (read them before writing features). Do NOT rewrite existing lib files; add new ones if needed, or make small additive edits.
- `src/components/ui/index.tsx` UI kit: `Card, Button, Input, Textarea, Select, Switch, Badge, Modal, Alert, CopyButton, Empty, Stat, Pagination, PageHeader, Tabs`. `form-state.tsx`: `SubmitButton, FormMessage, ActionState`. `confirm.tsx`: `ConfirmForm`. `charts.tsx`: `ClicksChart, BarsChart, DonutChart, TopList`.
- `src/components/layout/*` shells (public, dashboard, admin) already wired in `src/app/(public)/layout.tsx`, `src/app/dashboard/layout.tsx`, `src/app/admin/layout.tsx`.

## Key libs
- `db` from `@/lib/db`; JSON columns are strings: parse with `json(value, fallback)` from `@/lib/utils`.
- Auth: `currentUser()` (id, role, username, email), `currentDbUser()`, `requireUser()`, `requireAdmin()`, `hasAdminPermission(key)`, `hashPassword()` from `@/lib/auth`. Login page is `/login`. Use `signIn("credentials", {...})` from `next-auth/react` on the client.
- Workspace/teams: `getWorkspace()` from `@/lib/workspace` → `{ userId, ownerId, teamId, isTeam, perms }`. Resources are owned by `ownerId` (the team owner when a member switched into a team). `can(ws, "links", "create")` for team permissions.
- Plans: `getUserPlan(userId)` → `{ user, plan, features }`; `withinLimit(userId, "limitLinks")`; `PlanFeatures` keys in `@/lib/plan`. Admins bypass limits.
- Settings: `getSettings()` (all keys; defaults in `DEFAULT_SETTINGS` in `@/lib/settings`), `getSetting(key)`, `setSettings({...})`.
- Links: `createLink(userId|null, input)`, `updateLink()`, `validateUrl()`, `isAliasAvailable()`, `shortUrl(link)`, `parseLinkJson(link)` from `@/lib/links`. Throws `LinkError(message, status)`.
- Redirect engine: `resolveLink(link, visitor, query)`, `recordClick()`, `recordBioView()`, `recordQrScan()` from `@/lib/redirect`; `parseVisitor(headers)` from `@/lib/geo`.
- Stats: `getStats(filter, days)` and `recentClicks()` from `@/lib/stats`.
- Mail: `sendMail()`, `sendTemplate(slug, to, vars)` from `@/lib/mail` (templates in DB `EmailTemplate`).
- Uploads: `storeFile(file, folder)` from `@/lib/storage` → `{ url }`.
- Notifications: `notify(userId, title, message, {link})`, `notifyAdmins()` from `@/lib/notify`.
- Webhooks (Zapier/custom): `dispatchWebhooks(userId, event, payload)`.
- Captcha: `verifyCaptcha(token, ip)`, `captchaClientConfig()`.
- AI: `aiComplete(userId, feature, prompt)`.
- API auth: `apiAuth(req, "links.write")` → `{ user, plan, features, isAdmin } | { error: NextResponse }`; `apiOk()`, `apiError()`, `rateLimit()`.
- Permissions lists: `ADMIN_PERMISSIONS`, `TEAM_PERMISSIONS` in `@/lib/permissions`.
- i18n: `getDictionary(code)`, `translator(dict)`; strings in `src/locales/en.json` (add keys freely).

## Patterns
- Pages are async server components; mutations are server actions in a co-located `actions.ts` (`"use server"`), returning `ActionState` (`{ ok, error, message }`) and calling `revalidatePath`. Use `useActionState` in client forms with `SubmitButton`/`FormMessage`.
- Every dashboard page: `const ws = await getWorkspace(); if (!ws) redirect("/login");` and scope queries by `ws.ownerId`.
- Every admin page: `await requireAdmin()` (layout already guards) and check `hasAdminPermission("x")` for custom roles.
- Always enforce plan limits/features server-side in actions (`withinLimit`, `features.x`), show an upgrade hint in the UI when a feature is locked.
- Keep files reasonably sized; split large forms into client components under the same folder.
- Short link/bio/page URLs: root `/{alias}` handled by `src/app/[alias]/page.tsx`. Default bio page also at `/u/{username}`.
- Do not use `any`. Prefer `unknown` + narrowing. `pnpm typecheck` must pass.
