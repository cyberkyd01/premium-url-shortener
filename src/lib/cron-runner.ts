import { promises as fs } from "fs";
import path from "path";
import { parse as parseCsv } from "csv-parse/sync";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { getSettings } from "./settings";
import { sendTemplate } from "./mail";
import { notify } from "./notify";
import { createLink } from "./links";
import { planFeatures } from "./plan";
import { formatDate, json } from "./utils";
import { premiumCronJobs } from "./cron-jobs/index";
import { remindersJob } from "./cron-jobs/reminders";
import { retryFailedWebhooks } from "./webhooks";
import { tempMailJob } from "./cron-jobs/tempmail";

export type CronSummary = Record<string, unknown>;
export type CronJob = () => Promise<CronSummary>;

/** Validates `Authorization: Bearer <CRON_SECRET>` or `?secret=`. */
export function cronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "change-me") return { ok: false as const, reason: "CRON_SECRET is not configured" };
  const header = req.headers.get("authorization") || "";
  const provided = header.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("secret") || "";
  return provided === secret ? { ok: true as const } : { ok: false as const, reason: "Invalid cron secret" };
}

async function freePlan() {
  return db.plan.findFirst({ where: { isFree: true }, orderBy: { sortOrder: "asc" } });
}

/** Moves a user to the free plan, disables paid-only redirect types and emails them. */
async function downgradeUser(userId: string, reason: "expired" | "trial" | "subscription") {
  const user = await db.user.findUnique({ where: { id: userId }, include: { plan: true } });
  const free = await freePlan();
  if (!user) return;
  const freeFeatures = planFeatures(free);
  await db.user.update({ where: { id: userId }, data: { planId: free?.id ?? null, planExpires: null, planTrialEnds: null } });
  // Temporarily disable custom splash pages / overlays that the free plan does not include.
  const fallback = freeFeatures.redirectTypes.includes("splash") ? "splash" : "direct";
  const disabled: string[] = [];
  if (!freeFeatures.customSplash || !freeFeatures.redirectTypes.includes("custom")) disabled.push("custom");
  if (!freeFeatures.overlays || !freeFeatures.redirectTypes.includes("overlay")) disabled.push("overlay");
  if (disabled.length) await db.link.updateMany({ where: { userId, redirectType: { in: disabled } }, data: { redirectType: fallback } });
  const planName = user.plan?.name ?? "premium";
  if (user.notifyEmail) await sendTemplate("plan-expired", user.email, { plan: planName, username: user.username, name: user.name ?? user.username }, user.language);
  await notify(userId, reason === "trial" ? "Your trial has ended" : "Your plan has expired", `Your ${planName} plan ${reason === "trial" ? "trial ended" : "expired"} and your account was switched to the free plan.`, { type: "warning", link: "/dashboard/billing" });
}

export const cronJobs: Record<string, CronJob> = {
  /** Users whose paid plan or trial ended → free plan + email. */
  "expire-plans": async () => {
    const now = new Date();
    const expired = await db.user.findMany({ where: { planExpires: { lt: now }, plan: { isFree: false }, role: { not: "admin" } }, select: { id: true } });
    for (const u of expired) await downgradeUser(u.id, "expired");
    const trials = await db.user.findMany({ where: { planTrialEnds: { lt: now }, OR: [{ planExpires: null }, { planExpires: { lt: now } }], plan: { isFree: false }, role: { not: "admin" } }, select: { id: true } });
    for (const u of trials) await downgradeUser(u.id, "trial");
    // Clear stale trial markers on users that already renewed.
    const cleared = await db.user.updateMany({ where: { planTrialEnds: { lt: now }, planExpires: { gt: now } }, data: { planTrialEnds: null } });
    return { expired: expired.length, trialsEnded: trials.length, trialMarkersCleared: cleared.count };
  },

  /** Expired anonymous links are deleted; expired user links are kept (the redirect engine shows the expired page / expiredUrl). */
  "expire-links": async () => {
    const s = await getSettings();
    const now = new Date();
    const anonDays = parseInt(s["links.anonymousExpiryDays"] || "0", 10);
    let anonymousDeleted = 0;
    if (anonDays > 0) {
      const r = await db.link.deleteMany({ where: { isAnonymous: true, OR: [{ expiresAt: { lt: now } }, { expiresAt: null, createdAt: { lt: new Date(now.getTime() - anonDays * 86400000) } }] } });
      anonymousDeleted = r.count;
    }
    const expiredUserLinks = await db.link.count({ where: { isAnonymous: false, expiresAt: { lt: now } } });
    const expiredFiles = await db.hostedFile.deleteMany({ where: { expiresAt: { lt: now } } });
    return { anonymousDeleted, expiredUserLinks, expiredFilesDeleted: expiredFiles.count };
  },

  /** Deletes click rows beyond each plan's stats retention, global cleanupDays, and stale import jobs / invites / tokens. */
  cleanup: async () => {
    const s = await getSettings();
    const now = new Date();
    let clicksDeleted = 0;
    const plans = await db.plan.findMany();
    for (const plan of plans) {
      const days = planFeatures(plan).statsRetentionDays;
      if (!days || days <= 0) continue;
      const before = new Date(now.getTime() - days * 86400000);
      const r = await db.click.deleteMany({ where: { createdAt: { lt: before }, OR: [{ link: { user: { planId: plan.id, role: { not: "admin" } } } }, { bioPage: { user: { planId: plan.id, role: { not: "admin" } } } }, { qrCode: { user: { planId: plan.id, role: { not: "admin" } } } }] } });
      clicksDeleted += r.count;
    }
    const cleanupDays = parseInt(s["links.cleanupDays"] || "0", 10);
    if (cleanupDays > 0) {
      const r = await db.click.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - cleanupDays * 86400000) } } });
      clicksDeleted += r.count;
    }
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const [imports, invites, tokens, loginHistory] = await Promise.all([
      db.importJob.deleteMany({ where: { status: { in: ["done", "failed"] }, createdAt: { lt: monthAgo } } }),
      db.teamInvite.deleteMany({ where: { accepted: false, expiresAt: { lt: now } } }),
      db.user.updateMany({ where: { resetExpires: { lt: now } }, data: { resetToken: null, resetExpires: null } }),
      db.loginHistory.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * 86400000) } } }),
    ]);
    return { clicksDeleted, importJobsDeleted: imports.count, invitesDeleted: invites.count, resetTokensCleared: tokens.count, loginHistoryDeleted: loginHistory.count };
  },

  /** Marks lapsed subscriptions past_due, then expires + downgrades after a 3 day grace period. */
  subscriptions: async () => {
    const now = new Date();
    const grace = new Date(now.getTime() - 3 * 86400000);
    const lapsed = await db.subscription.findMany({ where: { status: { in: ["active", "trialing"] }, currentPeriodEnd: { lt: now } } });
    for (const sub of lapsed) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
      await notify(sub.userId, "Payment overdue", "We could not confirm your latest subscription payment. Please update your billing details within 3 days to keep your plan.", { type: "warning", link: "/dashboard/billing" });
    }
    const overdue = await db.subscription.findMany({ where: { status: "past_due", currentPeriodEnd: { lt: grace } } });
    let downgraded = 0;
    for (const sub of overdue) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "expired" } });
      const user = await db.user.findUnique({ where: { id: sub.userId }, select: { planId: true, planExpires: true } });
      const stillActive = await db.subscription.findFirst({ where: { userId: sub.userId, status: { in: ["active", "trialing"] }, NOT: { id: sub.id } } });
      if (user?.planId === sub.planId && !stillActive && (!user.planExpires || user.planExpires < now)) { await downgradeUser(sub.userId, "subscription"); downgraded++; }
    }
    const cancelled = await db.subscription.findMany({ where: { status: "cancelled", cancelAt: { lt: now } } });
    for (const sub of cancelled) {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "expired" } });
      const user = await db.user.findUnique({ where: { id: sub.userId }, select: { planId: true, planExpires: true } });
      if (user?.planId === sub.planId && (!user.planExpires || user.planExpires < now)) { await downgradeUser(sub.userId, "subscription"); downgraded++; }
    }
    return { markedPastDue: lapsed.length, expired: overdue.length + cancelled.length, downgraded };
  },

  /** Emails "plan-expiring" 3 days before planExpires (once per day, guarded by a Notification row). */
  "notify-expiring": async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 86400000);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const users = await db.user.findMany({ where: { planExpires: { gt: now, lte: soon }, plan: { isFree: false } }, include: { plan: true } });
    let sent = 0;
    for (const u of users) {
      const hasActiveSub = await db.subscription.findFirst({ where: { userId: u.id, status: { in: ["active", "trialing"] }, currentPeriodEnd: { gt: soon } } });
      if (hasActiveSub) continue; // auto-renewing, no need to nag
      const already = await db.notification.findFirst({ where: { userId: u.id, title: "Plan expiring soon", createdAt: { gte: todayStart } } });
      if (already) continue;
      const date = formatDate(u.planExpires);
      if (u.notifyEmail) await sendTemplate("plan-expiring", u.email, { plan: u.plan?.name ?? "premium", date, username: u.username, name: u.name ?? u.username }, u.language);
      await notify(u.id, "Plan expiring soon", `Your ${u.plan?.name ?? "premium"} plan expires on ${date}. Renew to keep your premium features.`, { type: "warning", link: "/dashboard/billing" });
      sent++;
    }
    return { candidates: users.length, sent };
  },

  /** Processes pending ImportJob rows (CSV in public/uploads/imports/{filename}) in batches of 200 rows per run. */
  imports: async () => {
    const BATCH = 200;
    const jobs = await db.importJob.findMany({ where: { status: { in: ["pending", "processing"] } }, orderBy: { createdAt: "asc" }, take: 5 });
    const results: CronSummary[] = [];
    for (const job of jobs) {
      const candidates = [path.join(process.cwd(), "public", "uploads", "imports", job.filename), path.join(process.cwd(), "storage", "imports", job.filename), path.join(process.cwd(), "public", "uploads", job.filename)];
      let content: string | null = null;
      for (const file of candidates) { try { content = await fs.readFile(file, "utf8"); break; } catch { /* try next */ } }
      if (content === null) {
        await db.importJob.update({ where: { id: job.id }, data: { status: "failed", errors: JSON.stringify([`File not found: ${job.filename}`]) } });
        results.push({ id: job.id, status: "failed", reason: "file not found" });
        continue;
      }
      let rows: Record<string, string>[] = [];
      try {
        rows = parseCsv(content, { columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()), skip_empty_lines: true, trim: true, relax_column_count: true }) as Record<string, string>[];
      } catch {
        // No header row: treat the first column as the URL.
        rows = parseCsv(content, { skip_empty_lines: true, trim: true, relax_column_count: true }).map((r: string[]) => ({ url: r[0] ?? "", alias: r[1] ?? "", title: r[2] ?? "" }));
      }
      if (rows.length && !("url" in rows[0]) && !("long_url" in rows[0]) && !("link" in rows[0])) {
        rows = parseCsv(content, { skip_empty_lines: true, trim: true, relax_column_count: true }).map((r: string[]) => ({ url: r[0] ?? "", alias: r[1] ?? "", title: r[2] ?? "" }));
      }
      const offset = job.processed + job.failed;
      const slice = rows.slice(offset, offset + BATCH);
      const errors = json<string[]>(job.errors, []);
      let processed = 0, failed = 0;
      await db.importJob.update({ where: { id: job.id }, data: { status: "processing", total: rows.length } });
      for (const row of slice) {
        const url = row.url || row.long_url || row.link || row.destination || "";
        try {
          if (!url) throw new Error("Empty url");
          await createLink(job.userId, { url, alias: row.alias || row.custom || row.slug || null, title: row.title || null, description: row.description || null, campaignId: row.campaign || null, utm: row.utm_source ? { source: row.utm_source, medium: row.utm_medium ?? "", campaign: row.utm_campaign ?? "" } : undefined });
          processed++;
        } catch (e) {
          failed++;
          if (errors.length < 200) errors.push(`${url || "(row " + (offset + processed + failed) + ")"}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
      const done = offset + slice.length >= rows.length;
      await db.importJob.update({ where: { id: job.id }, data: { processed: { increment: processed }, failed: { increment: failed }, errors: JSON.stringify(errors), status: done ? "done" : "processing" } });
      if (done) await notify(job.userId, "Import finished", `${job.processed + processed} links imported, ${job.failed + failed} failed.`, { type: failed ? "warning" : "success", link: "/dashboard/links" });
      results.push({ id: job.id, processed, failed, total: rows.length, done });
    }
    return { jobs: results.length, results };
  },

  /** Resets the monthly AI credit usage counter for users whose reset date passed. */
  "reset-ai-credits": async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const r = await db.user.updateMany({ where: { OR: [{ aiCreditsResetAt: null, aiCredits: { gt: 0 } }, { aiCreditsResetAt: { lt: monthStart } }] }, data: { aiCredits: 0, aiCreditsResetAt: now } });
    return { usersReset: r.count, nextResetAfter: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString() };
  },

  /** Recomputes per-user storage usage from HostedFile rows and reports local upload counts. */
  "storage-sync": async () => {
    const groups = await db.hostedFile.groupBy({ by: ["userId"], _sum: { size: true }, _count: { _all: true } });
    for (const g of groups) await db.user.update({ where: { id: g.userId }, data: { storageUsed: g._sum.size ?? 0 } }).catch(() => {});
    const withFiles = groups.map((g) => g.userId);
    const zeroed = await db.user.updateMany({ where: { storageUsed: { gt: 0 }, NOT: { id: { in: withFiles } } }, data: { storageUsed: 0 } });
    let localFiles = 0, localBytes = 0;
    const walk = async (dir: string) => {
      let entries: import("fs").Dirent[] = [];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else { localFiles++; try { localBytes += (await fs.stat(p)).size; } catch { /* ignore */ } }
      }
    };
    await walk(path.join(process.cwd(), "public", "uploads"));
    return { usersSynced: groups.length, usersZeroed: zeroed.count, hostedFiles: groups.reduce((s, g) => s + g._count._all, 0), hostedBytes: groups.reduce((s, g) => s + (g._sum.size ?? 0), 0), localFiles, localBytes };
  },

  /** Dumps key tables to storage/backups/backup-<timestamp>.json and keeps the 10 most recent dumps. */
  backup: async () => {
    const dir = path.join(process.cwd(), "storage", "backups");
    await fs.mkdir(dir, { recursive: true });
    const [users, plans, domains, links, campaigns, channels, pixels, bioPages, bioBlocks, qrCodes, settings, splashPages, overlays, webhooks, apiKeys, subscriptions, payments] = await Promise.all([
      db.user.findMany({ select: { id: true, username: true, email: true, name: true, role: true, status: true, planId: true, planExpires: true, language: true, timezone: true, createdAt: true } }),
      db.plan.findMany(), db.domain.findMany(), db.link.findMany({ include: { pixels: true } }), db.campaign.findMany(), db.channel.findMany(), db.pixel.findMany(),
      db.bioPage.findMany(), db.bioBlock.findMany(), db.qrCode.findMany(), db.setting.findMany(), db.splashPage.findMany(), db.overlay.findMany(),
      db.webhook.findMany({ select: { id: true, userId: true, name: true, url: true, events: true, provider: true, active: true } }),
      db.apiKey.findMany({ select: { id: true, userId: true, name: true, permissions: true, active: true, createdAt: true } }),
      db.subscription.findMany(), db.payment.findMany(),
    ]);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `backup-${stamp}.json`);
    const payload = { version: 1, createdAt: new Date().toISOString(), tables: { users, plans, domains, links, campaigns, channels, pixels, bioPages, bioBlocks, qrCodes, settings, splashPages, overlays, webhooks, apiKeys, subscriptions, payments } };
    await fs.writeFile(file, JSON.stringify(payload));
    const existing = (await fs.readdir(dir)).filter((f) => f.startsWith("backup-") && f.endsWith(".json")).sort();
    const removed: string[] = [];
    while (existing.length > 10) { const old = existing.shift()!; await fs.unlink(path.join(dir, old)).catch(() => {}); removed.push(old); }
    const size = (await fs.stat(file)).size;
    return { file: path.relative(process.cwd(), file), bytes: size, counts: Object.fromEntries(Object.entries(payload.tables).map(([k, v]) => [k, v.length])), removed };
  },
};

// Premium jobs: link health monitor, traffic alerts, scheduled email reports, webhook retries, expiry/go-live reminders.
Object.assign(cronJobs, premiumCronJobs, {
  reminders: async () => ((await remindersJob()) ?? {}) as CronSummary,
  "webhook-retry": async () => ((await retryFailedWebhooks()) ?? {}) as CronSummary,
  tempmail: () => tempMailJob(),
});

export const CRON_JOB_NAMES = Object.keys(cronJobs);

/** Runs a job, records a CronLog row and returns the summary. */
export async function runCronJob(name: string): Promise<{ job: string; status: "ok" | "error"; ms: number; summary?: CronSummary; message?: string }> {
  const job = cronJobs[name];
  if (!job) return { job: name, status: "error", ms: 0, message: "Unknown job" };
  const started = Date.now();
  try {
    const summary = await job();
    const ms = Date.now() - started;
    await db.cronLog.create({ data: { job: name, status: "ok", message: JSON.stringify({ ms, ...summary }).slice(0, 4000) } }).catch(() => {});
    return { job: name, status: "ok", ms, summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.cronLog.create({ data: { job: name, status: "error", message: message.slice(0, 4000) } }).catch(() => {});
    console.error(`[cron:${name}]`, e);
    return { job: name, status: "error", ms: Date.now() - started, message };
  }
}
