import { db } from "./db";
import { notify } from "./notify";
import { sendMail } from "./mail";
import { getSettings } from "./settings";
import { appUrl, escapeHtml, formatNumber } from "./utils";

const ALERT_COOLDOWN_MS = 24 * 3600 * 1000;
const SPIKE_MULTIPLIER = 5;
const SPIKE_MIN_CLICKS = 50;

export type AlertKind = "threshold" | "spike";

async function sendAlert(link: { id: string; alias: string; userId: string | null; title: string | null }, kind: AlertKind, detail: { clicks: number; threshold?: number; average?: number }) {
  if (!link.userId) return;
  const s = await getSettings();
  const user = await db.user.findUnique({ where: { id: link.userId }, select: { email: true, notifyEmail: true, username: true } });
  const title = kind === "spike" ? `Traffic spike on /${link.alias}` : `/${link.alias} passed ${formatNumber(detail.threshold ?? 0)} clicks`;
  const message = kind === "spike"
    ? `${formatNumber(detail.clicks)} clicks in the last hour, ${detail.average ? Math.round(detail.clicks / detail.average) : "many"}x the usual hourly rate.`
    : `Your link has reached ${formatNumber(detail.clicks)} clicks (alert threshold: ${formatNumber(detail.threshold ?? 0)}).`;
  await db.link.update({ where: { id: link.id }, data: { alertSentAt: new Date() } });
  await notify(link.userId, title, message, { type: kind === "spike" ? "warning" : "success", link: `/dashboard/links/${link.id}` });
  if (user?.notifyEmail) {
    const html = `<p>Hi ${escapeHtml(user.username)},</p><p><b>${escapeHtml(title)}</b></p><p>${escapeHtml(message)}</p>
<p><a href="${appUrl(`/dashboard/links/${link.id}`)}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">View analytics</a></p>
<p style="color:#71717a;font-size:12px">You receive alerts for links with a click threshold, and when traffic spikes to ${SPIKE_MULTIPLIER}x the 7-day hourly average.</p>`;
    await sendMail({ to: user.email, subject: `[${s["site.name"]}] ${title}`, html });
  }
}

/**
 * Checks a single link for (a) a crossed click threshold and (b) a traffic spike:
 * clicks in the last hour > 5x the hourly average of the previous 7 days (min 50 clicks).
 * Both are guarded by `alertSentAt` (24h cooldown). Safe to call fire-and-forget after `recordClick`.
 */
export async function checkTrafficAlert(linkId: string): Promise<AlertKind | null> {
  const link = await db.link.findUnique({ where: { id: linkId }, select: { id: true, alias: true, userId: true, title: true, clicks: true, alertThreshold: true, alertSentAt: true } });
  if (!link || !link.userId) return null;
  const now = Date.now();
  const cooled = !link.alertSentAt || now - link.alertSentAt.getTime() > ALERT_COOLDOWN_MS;
  if (!cooled) return null;
  if (link.alertThreshold && link.clicks >= link.alertThreshold) {
    // Only alert once per crossing: skip when the threshold was already crossed at the last alert.
    const alreadyReported = link.alertSentAt && (await db.click.count({ where: { linkId, createdAt: { gt: link.alertSentAt } } })) === 0;
    if (!alreadyReported) { await sendAlert(link, "threshold", { clicks: link.clicks, threshold: link.alertThreshold }); return "threshold"; }
  }
  // Spike detection: cheap count first, then the baseline.
  const hourAgo = new Date(now - 3600 * 1000);
  const lastHour = await db.click.count({ where: { linkId, isBot: false, createdAt: { gte: hourAgo } } });
  if (lastHour < SPIKE_MIN_CLICKS) return null;
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
  const prevWeek = await db.click.count({ where: { linkId, isBot: false, createdAt: { gte: weekAgo, lt: hourAgo } } });
  const hourlyAvg = prevWeek / (7 * 24 - 1);
  if (lastHour > Math.max(SPIKE_MULTIPLIER * hourlyAvg, SPIKE_MIN_CLICKS - 1)) {
    await sendAlert(link, "spike", { clicks: lastHour, average: hourlyAvg });
    return "spike";
  }
  return null;
}

/** Scans links with clicks in the last hour (or with a threshold set) and evaluates alerts. Used by the cron job. */
export async function scanTrafficAlerts(limit = 500) {
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const recent = await db.click.groupBy({ by: ["linkId"], where: { createdAt: { gte: hourAgo }, linkId: { not: null } }, _count: { _all: true }, orderBy: { _count: { linkId: "desc" } }, take: limit });
  const ids = new Set<string>();
  for (const r of recent) if (r.linkId) ids.add(r.linkId);
  const withThreshold = await db.link.findMany({ where: { alertThreshold: { not: null }, userId: { not: null }, status: "active" }, select: { id: true }, take: limit });
  for (const l of withThreshold) ids.add(l.id);
  let thresholds = 0, spikes = 0;
  for (const id of ids) {
    try {
      const r = await checkTrafficAlert(id);
      if (r === "threshold") thresholds++; else if (r === "spike") spikes++;
    } catch (e) { console.error("[alerts]", id, e); }
  }
  return { scanned: ids.size, thresholdAlerts: thresholds, spikeAlerts: spikes };
}
