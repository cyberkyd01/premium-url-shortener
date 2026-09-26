import { db } from "./db";
import { daysAgo, appUrl } from "./utils";
import type { VisitorInfo } from "./geo";
import { dispatchWebhooks } from "./webhooks";

export const ATTRIBUTION_DAYS = 7;

export interface ConversionInput {
  linkId?: string | null;
  alias?: string | null;
  goal?: string | null;
  value?: number | null;
  clickId?: string | null;
  meta?: Record<string, unknown>;
}

export class ConversionError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function cleanGoal(goal: string | null | undefined) {
  const g = (goal ?? "").trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, "-").slice(0, 60);
  return g || "conversion";
}

/** Finds the link a conversion refers to (by id or by alias on the main domain / any domain). */
export async function findConversionLink(input: Pick<ConversionInput, "linkId" | "alias">) {
  if (input.linkId) return db.link.findUnique({ where: { id: input.linkId }, select: { id: true, alias: true, userId: true, status: true } });
  if (input.alias) {
    const alias = input.alias.trim().replace(/^\//, "");
    return db.link.findFirst({ where: { alias }, orderBy: { domainId: "asc" }, select: { id: true, alias: true, userId: true, status: true } });
  }
  return null;
}

/**
 * Attributes a click to the conversion: an explicit clickId (must belong to the link) wins;
 * otherwise the most recent click from the same visitor (ipHash, which is salted per day) within
 * ATTRIBUTION_DAYS is used, falling back to the most recent click from the same raw IP.
 */
export async function attributeClick(linkId: string, v: Pick<VisitorInfo, "ip" | "ipHash">, clickId?: string | null) {
  if (clickId) {
    const c = await db.click.findFirst({ where: { id: clickId, linkId }, select: { id: true } });
    if (c) return c.id;
  }
  const since = new Date(Date.now() - ATTRIBUTION_DAYS * 86400000);
  const byHash = await db.click.findFirst({ where: { linkId, ipHash: v.ipHash, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (byHash) return byHash.id;
  const byIp = await db.click.findFirst({ where: { linkId, ip: v.ip, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return byIp?.id ?? null;
}

/** Records a conversion for a link and bumps the link counters. Duplicate goal+click pairs within 24h are ignored. */
export async function recordConversion(input: ConversionInput, v: VisitorInfo) {
  const link = await findConversionLink(input);
  if (!link) throw new ConversionError("Link not found", 404);
  const goal = cleanGoal(input.goal);
  const value = Math.max(0, Math.min(1e9, Number(input.value) || 0));
  const clickId = await attributeClick(link.id, v, input.clickId);
  if (clickId) {
    const dup = await db.conversion.findFirst({ where: { linkId: link.id, clickId, goal, createdAt: { gte: new Date(Date.now() - 86400000) } }, select: { id: true } });
    if (dup) return { id: dup.id, linkId: link.id, clickId, goal, value, duplicate: true };
  }
  const [conv] = await db.$transaction([
    db.conversion.create({ data: { linkId: link.id, clickId, goal, value, ip: v.ip, country: v.countryCode, device: v.device, meta: JSON.stringify(input.meta ?? {}).slice(0, 2000) } }),
    db.link.update({ where: { id: link.id }, data: { conversions: { increment: 1 }, conversionValue: { increment: value } } }),
  ]);
  if (link.userId) dispatchWebhooks(link.userId, "link.clicked", { id: link.id, alias: link.alias, event: "conversion", goal, value, clickId }).catch(() => {});
  return { id: conv.id, linkId: link.id, clickId, goal, value, duplicate: false };
}

export async function deleteConversion(id: string, ownerId: string) {
  const conv = await db.conversion.findFirst({ where: { id, link: { userId: ownerId } }, select: { id: true, linkId: true, value: true } });
  if (!conv) return false;
  await db.$transaction([
    db.conversion.delete({ where: { id: conv.id } }),
    db.link.update({ where: { id: conv.linkId }, data: { conversions: { decrement: 1 }, conversionValue: { decrement: conv.value } } }),
  ]);
  return true;
}

/** Conversion analytics for one link over `days`. */
export async function getConversionStats(linkId: string, days = 30) {
  const from = daysAgo(days);
  const [total, sum, uniqueClicks, byGoalRaw, byCountryRaw, rows, recent] = await Promise.all([
    db.conversion.count({ where: { linkId, createdAt: { gte: from } } }),
    db.conversion.aggregate({ where: { linkId, createdAt: { gte: from } }, _sum: { value: true } }),
    db.click.count({ where: { linkId, isUnique: true, isBot: false, createdAt: { gte: from } } }),
    db.conversion.groupBy({ by: ["goal"], where: { linkId, createdAt: { gte: from } }, _count: { _all: true }, _sum: { value: true }, orderBy: { _count: { goal: "desc" } } }),
    db.conversion.groupBy({ by: ["country"], where: { linkId, createdAt: { gte: from } }, _count: { _all: true }, orderBy: { _count: { country: "desc" } }, take: 10 }),
    db.conversion.findMany({ where: { linkId, createdAt: { gte: from } }, select: { createdAt: true, value: true } }),
    db.conversion.findMany({ where: { linkId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const byDay = new Map<string, { conversions: number; value: number }>();
  for (let i = days - 1; i >= 0; i--) byDay.set(daysAgo(i).toISOString().slice(0, 10), { conversions: 0, value: 0 });
  for (const r of rows) { const k = r.createdAt.toISOString().slice(0, 10); const cur = byDay.get(k) ?? { conversions: 0, value: 0 }; cur.conversions++; cur.value += r.value; byDay.set(k, cur); }
  return {
    total, value: sum._sum.value ?? 0, uniqueClicks, rate: uniqueClicks ? total / uniqueClicks : 0,
    byGoal: byGoalRaw.map((g) => ({ label: g.goal, count: g._count._all, value: g._sum.value ?? 0 })),
    byCountry: byCountryRaw.map((c) => ({ label: c.country ?? "Unknown", count: c._count._all })),
    byDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    recent,
  };
}

/** Embed snippets shown on the conversions page. */
export function conversionSnippets(alias: string) {
  const base = appUrl();
  return {
    script: `<script src="${base}/conv.js" data-link="${alias}" data-goal="signup" data-value="0" async></script>`,
    api: `<script src="${base}/conv.js" data-link="${alias}" data-manual="1" async></script>\n<script>\n  // later, e.g. after checkout:\n  window.pus('convert', { goal: 'purchase', value: 49.99 });\n</script>`,
    pixel: `<img src="${base}/api/conv/pixel.gif?alias=${encodeURIComponent(alias)}&goal=open" width="1" height="1" alt="" style="display:none" />`,
    curl: `curl -X POST ${base}/api/conv -H 'content-type: application/json' -d '{"alias":"${alias}","goal":"lead","value":10}'`,
  };
}
