import { db } from "../db";
import { notify } from "../notify";
import { sendTemplate } from "../mail";
import { shortUrl } from "../links";
import { formatDate } from "../utils";

/** Cron: reminds owners about links expiring within 3 days and scheduled links going live today (each once). */
export async function remindersJob() {
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86400_000);
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  let expiring = 0, live = 0;

  const expiringLinks = await db.link.findMany({ where: { userId: { not: null }, isArchived: false, expiresAt: { gt: now, lte: in3d } }, include: { domain: true, user: { select: { id: true, email: true, username: true, name: true, language: true, notifyEmail: true } } }, take: 500 });
  for (const link of expiringLinks) {
    if (!link.user) continue;
    const key = `/dashboard/links/${link.id}?reminder=expiry`;
    const already = await db.notification.findFirst({ where: { userId: link.user.id, link: key }, select: { id: true } });
    if (already) continue;
    const short = shortUrl(link);
    const when = formatDate(link.expiresAt, true);
    await notify(link.user.id, "Link expiring soon", `${short} expires on ${when}. Extend the expiration date if you still need it.`, { type: "warning", link: key });
    if (link.user.notifyEmail) await sendTemplate("link-expiring", link.user.email, { short, url: link.url, expires: when, username: link.user.username, name: link.user.name ?? link.user.username, edit_url: `${short.replace(/\/[^/]+$/, "")}/dashboard/links/${link.id}/edit` }, link.user.language);
    expiring++;
  }

  const goingLive = await db.link.findMany({ where: { userId: { not: null }, isArchived: false, activateAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lte: endOfDay } }, include: { domain: true, user: { select: { id: true, email: true, username: true, name: true, language: true, notifyEmail: true } } }, take: 500 });
  for (const link of goingLive) {
    if (!link.user) continue;
    const key = `/dashboard/links/${link.id}?reminder=live`;
    const already = await db.notification.findFirst({ where: { userId: link.user.id, link: key }, select: { id: true } });
    if (already) continue;
    const short = shortUrl(link);
    const when = formatDate(link.activateAt, true);
    await notify(link.user.id, "Scheduled link goes live today", `${short} becomes active at ${when}.`, { type: "info", link: key });
    if (link.user.notifyEmail) await sendTemplate("link-going-live", link.user.email, { short, url: link.url, activates: when, username: link.user.username, name: link.user.name ?? link.user.username }, link.user.language);
    live++;
  }
  // Click threshold alerts ("Alert me when clicks reach N"), sent once per threshold.
  let alerts = 0;
  const reached = await db.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "Link" WHERE "alertThreshold" IS NOT NULL AND "alertSentAt" IS NULL AND "userId" IS NOT NULL AND "clicks" >= "alertThreshold" LIMIT 500').catch(() => [] as { id: string }[]);
  for (const { id } of reached) {
    const link = await db.link.findUnique({ where: { id }, include: { domain: true, user: { select: { id: true, email: true, username: true, name: true, language: true, notifyEmail: true } } } });
    if (!link?.user || !link.alertThreshold) continue;
    const short = shortUrl(link);
    await db.link.update({ where: { id }, data: { alertSentAt: now } });
    await notify(link.user.id, "Click goal reached", `${short} reached ${link.alertThreshold} clicks (now ${link.clicks}).`, { type: "success", link: `/dashboard/links/${link.id}` });
    if (link.user.notifyEmail) await sendTemplate("link-click-alert", link.user.email, { short, url: link.url, threshold: String(link.alertThreshold), clicks: String(link.clicks), username: link.user.username, name: link.user.name ?? link.user.username }, link.user.language);
    alerts++;
  }
  return { expiringReminded: expiring, goingLiveReminded: live, clickAlerts: alerts };
}
