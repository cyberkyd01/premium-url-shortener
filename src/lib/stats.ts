import { db } from "./db";
import { daysAgo } from "./utils";

export interface StatsFilter { linkId?: string; linkIds?: string[]; bioPageId?: string; qrCodeId?: string; userId?: string; from?: Date; to?: Date }

function where(f: StatsFilter) {
  const w: Record<string, unknown> = { isBot: false };
  if (f.linkId) w.linkId = f.linkId;
  if (f.linkIds) w.linkId = { in: f.linkIds };
  if (f.bioPageId) w.bioPageId = f.bioPageId;
  if (f.qrCodeId) w.qrCodeId = f.qrCodeId;
  if (f.userId) w.link = { userId: f.userId };
  if (f.from || f.to) w.createdAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
  return w;
}

async function groupBy(field: "countryCode" | "city" | "region" | "refererHost" | "browser" | "os" | "device" | "language" | "targetUrl" | "utmSource" | "utmMedium" | "utmCampaign", f: StatsFilter, limit = 10) {
  const rows = await db.click.groupBy({ by: [field], where: where(f), _count: { _all: true }, orderBy: { _count: { id: "desc" } }, take: limit });
  return rows.map((r) => ({ label: (r[field] as string | null) ?? "Unknown", count: r._count._all }));
}

/** Full analytics bundle used by link, bio, QR, campaign and dashboard overview screens. */
export async function getStats(f: StatsFilter, days = 30) {
  const from = f.from ?? daysAgo(days);
  const filter = { ...f, from };
  const w = where(filter);
  const [total, unique, clicksRaw, countries, cities, regions, referers, browsers, os, devices, languages, targets, utmSources, utmMediums, utmCampaigns, points, hours] = await Promise.all([
    db.click.count({ where: w }),
    db.click.count({ where: { ...w, isUnique: true } }),
    db.click.findMany({ where: w, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    groupBy("countryCode", filter, 20), groupBy("city", filter, 10), groupBy("region", filter, 10), groupBy("refererHost", filter, 10),
    groupBy("browser", filter), groupBy("os", filter), groupBy("device", filter), groupBy("language", filter), groupBy("targetUrl", filter),
    groupBy("utmSource", filter), groupBy("utmMedium", filter), groupBy("utmCampaign", filter),
    db.click.findMany({ where: { ...w, lat: { not: null } }, select: { lat: true, lng: true }, take: 2000 }),
    db.click.findMany({ where: w, select: { createdAt: true }, take: 5000 }),
  ]);
  const byDay = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(daysAgo(i).toISOString().slice(0, 10), 0);
  for (const c of clicksRaw) { const k = c.createdAt.toISOString().slice(0, 10); byDay.set(k, (byDay.get(k) ?? 0) + 1); }
  const byHour = new Array(24).fill(0);
  for (const c of hours) byHour[c.createdAt.getHours()]++;
  return {
    total, unique, byDay: [...byDay.entries()].map(([date, clicks]) => ({ date, clicks })), byHour: byHour.map((clicks, hour) => ({ hour, clicks })),
    countries, cities, regions, referers, browsers, os, devices, languages, targets, utmSources, utmMediums, utmCampaigns,
    heatmap: points.map((p) => [p.lat!, p.lng!] as [number, number]),
  };
}

export async function recentClicks(f: StatsFilter, take = 50) {
  return db.click.findMany({ where: where(f), orderBy: { createdAt: "desc" }, take, include: { link: { select: { alias: true, url: true } } } });
}
