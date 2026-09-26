import type { Link } from "@prisma/client";
import { db } from "./db";
import { parseLinkJson } from "./links";
import { detectDeepLink } from "./deeplinks";
import { appendParams, json } from "./utils";
import type { VisitorInfo } from "./geo";
import { dispatchWebhooks } from "./webhooks";
import { getSettings } from "./settings";

export type Resolution =
  | { kind: "redirect"; url: string }
  | { kind: "password" }
  | { kind: "expired"; url?: string | null }
  | { kind: "limit"; url?: string | null }
  | { kind: "pending" }
  | { kind: "disabled" }
  | { kind: "blocked" }
  | { kind: "scheduled"; activateAt: Date }
  | { kind: "interstitial"; type: "frame" | "splash" | "custom" | "overlay" | "deeplink" | "breakout" | "cloak"; url: string };

function inTimeWindow(t: { from: string; to: string; days?: number[]; timezone?: string }, now: Date) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: t.timezone || "UTC", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const hm = `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
    const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    if (t.days?.length && !t.days.includes(dayIdx)) return false;
    return t.from <= t.to ? hm >= t.from && hm <= t.to : hm >= t.from || hm <= t.to;
  } catch { return false; }
}

function evalRule(rule: { field: string; op: string; value: string }, v: VisitorInfo, req: { query: URLSearchParams; now: Date }) {
  const map: Record<string, string> = {
    country: v.countryCode ?? "", region: v.region ?? "", city: v.city ?? "", device: v.device, os: v.os ?? "", browser: v.browser ?? "",
    language: v.language ?? "", referer: v.refererHost ?? "", ip: v.ip, hour: String(req.now.getUTCHours()), day: String(req.now.getUTCDay()),
    inapp: v.inApp ?? "", bot: v.isBot ? "1" : "0",
  };
  const actual = (rule.field.startsWith("param:") ? req.query.get(rule.field.slice(6)) ?? "" : map[rule.field] ?? "").toLowerCase();
  const expected = rule.value.toLowerCase();
  switch (rule.op) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "in": return expected.split(",").map((x) => x.trim()).includes(actual);
    case "nin": return !expected.split(",").map((x) => x.trim()).includes(actual);
    case "contains": return actual.includes(expected);
    case "starts": return actual.startsWith(expected);
    case "gt": return parseFloat(actual) > parseFloat(expected);
    case "lt": return parseFloat(actual) < parseFloat(expected);
    case "exists": return actual !== "";
    default: return false;
  }
}

/** Picks the destination for a visitor: priority = advanced conditions > language > device > geo > time > A/B > default. */
export function chooseTarget(link: Link, v: VisitorInfo, query: URLSearchParams, clickIndex = 0) {
  const p = parseLinkJson(link);
  const now = new Date();
  for (const c of p.conditions) {
    const results = c.rules.map((r) => evalRule(r, v, { query, now }));
    if (c.rules.length && (c.match === "any" ? results.some(Boolean) : results.every(Boolean))) return c.url;
  }
  const lang = p.langTargets.find((t) => t.lang.toLowerCase() === (v.language ?? "").toLowerCase());
  if (lang) return lang.url;
  const osName = (v.os ?? "").toLowerCase();
  const dev = p.deviceTargets.find((t) => {
    const d = t.device.toLowerCase();
    if (d === v.device) return true;
    if (d === "ios" || d === "iphone") return osName === "ios" && !/ipad/i.test(v.userAgent);
    if (d === "ipad") return /ipad/i.test(v.userAgent);
    if (d === "android") return osName === "android";
    if (d === "windows") return osName.startsWith("windows");
    if (d === "mac" || d === "macos") return osName.includes("mac");
    if (d === "linux") return osName === "linux";
    return false;
  });
  if (dev) return dev.url;
  const geo = p.geoTargets.find((t) => t.country.toUpperCase() === (v.countryCode ?? "").toUpperCase() && (!t.state || t.state.toLowerCase() === (v.region ?? "").toLowerCase()));
  if (geo) return geo.url;
  const time = p.timeTargets.find((t) => inTimeWindow(t, now));
  if (time) return time.url;
  if (p.abUrls.length) {
    const variants = [{ url: link.url, weight: 1 }, ...p.abUrls.map((a) => ({ url: a.url, weight: a.weight ?? 1 }))];
    if (link.rotatorMode === "rotate") return variants[clickIndex % variants.length].url;
    const total = variants.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * total;
    for (const x of variants) { r -= x.weight; if (r <= 0) return x.url; }
  }
  return link.url;
}

export function finalizeUrl(link: Link, target: string, query: URLSearchParams) {
  const p = parseLinkJson(link);
  const params: Record<string, string> = {};
  if (p.utm.source) params.utm_source = p.utm.source;
  if (p.utm.medium) params.utm_medium = p.utm.medium;
  if (p.utm.campaign) params.utm_campaign = p.utm.campaign;
  if (p.utm.term) params.utm_term = p.utm.term;
  if (p.utm.content) params.utm_content = p.utm.content;
  Object.assign(params, p.customParams);
  if (link.forwardParams) query.forEach((val, key) => { params[key] = val; });
  return appendParams(target, params);
}

/** Simple IP blocklist match: exact IP, CIDR (IPv4) or prefix ("192.168." / "2001:db8:"). */
export function ipBlocked(ip: string, patterns: string[]) {
  const v = ip.trim().toLowerCase();
  if (!v) return false;
  const toInt = (a: string) => { const parts = a.split("."); if (parts.length !== 4) return null; let n = 0; for (const p of parts) { const x = Number(p); if (!Number.isInteger(x) || x < 0 || x > 255) return null; n = n * 256 + x; } return n; };
  for (const raw of patterns) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    if (p === v) return true;
    if (p.includes("/")) {
      const [base, bitsStr] = p.split("/");
      const bits = parseInt(bitsStr, 10);
      const a = toInt(base); const b = toInt(v);
      if (a !== null && b !== null && bits >= 0 && bits <= 32) {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        if (((a & mask) >>> 0) === ((b & mask) >>> 0)) return true;
      }
      continue;
    }
    if (p.endsWith(".") || p.endsWith(":") || p.endsWith("*")) { if (v.startsWith(p.replace(/\*$/, ""))) return true; }
  }
  return false;
}

/** Resolves the link for this request without recording anything. */
export async function resolveLink(link: Link, v: VisitorInfo, query: URLSearchParams, opts: { passwordOk?: boolean } = {}): Promise<Resolution> {
  const s = await getSettings();
  if (link.status === "pending") return { kind: "pending" };
  if (link.status === "disabled") return { kind: "disabled" };
  if (link.status === "blocked") return { kind: "blocked" };
  if (link.activateAt && link.activateAt > new Date()) return { kind: "scheduled", activateAt: link.activateAt };
  const blockCountries = json<string[]>(link.blockCountries, []);
  if (blockCountries.length && v.countryCode && blockCountries.map((c) => c.toUpperCase()).includes(v.countryCode.toUpperCase())) return { kind: "blocked" };
  const blockIps = json<string[]>(link.blockIps, []);
  if (blockIps.length && ipBlocked(v.ip, blockIps)) return { kind: "blocked" };
  if (link.expiresAt && link.expiresAt < new Date()) return { kind: "expired", url: link.expiredUrl };
  if (link.clickLimit && link.clicks >= link.clickLimit) return { kind: "limit", url: link.clickLimitUrl };
  if ((link.botBlock || s["links.botBlock"] === "1") && v.isBot) return { kind: "blocked" };
  if (link.password && !opts.passwordOk) return { kind: "password" };
  const chosen = link.healthStatus === "broken" && link.fallbackUrl ? link.fallbackUrl : chooseTarget(link, v, query, link.clicks);
  const target = finalizeUrl(link, chosen, query);
  if (link.inAppBreakout && v.inApp && v.device !== "desktop") return { kind: "interstitial", type: "breakout", url: target };
  if (link.deepLink && v.device !== "desktop") {
    const cfg = parseLinkJson(link).deepLinkConfig;
    const auto = detectDeepLink(target);
    if (cfg.ios || cfg.android || auto) return { kind: "interstitial", type: "deeplink", url: target };
  }
  if (link.cloaking) return { kind: "interstitial", type: "cloak", url: target };
  if (link.redirectType !== "direct") return { kind: "interstitial", type: link.redirectType as "frame" | "splash" | "custom" | "overlay", url: target };
  return { kind: "redirect", url: target };
}

/** Records the click (system tracking) and increments counters. Unique = same ip hash within window. */
export async function recordClick(link: Link, v: VisitorInfo, target: string, query: URLSearchParams) {
  const s = await getSettings();
  if (s["links.trackingMethod"] !== "system") return;
  const windowH = parseInt(s["links.uniqueClicksWindow"] || "24", 10);
  const since = new Date(Date.now() - windowH * 3600 * 1000);
  const prev = await db.click.findFirst({ where: { linkId: link.id, ipHash: v.ipHash, createdAt: { gte: since } }, select: { id: true } });
  const isUnique = !prev;
  await db.$transaction([
    db.click.create({ data: {
      linkId: link.id, ip: s["misc.anonymousStats"] === "1" ? null : v.ip, ipHash: v.ipHash, country: v.country, countryCode: v.countryCode, region: v.region, city: v.city,
      lat: v.lat, lng: v.lng, referer: v.referer?.slice(0, 500), refererHost: v.refererHost, userAgent: v.userAgent, browser: v.browser, os: v.os, device: v.device,
      language: v.language, isUnique, isBot: v.isBot, targetUrl: target.slice(0, 1000),
      utmSource: query.get("utm_source"), utmMedium: query.get("utm_medium"), utmCampaign: query.get("utm_campaign"),
    } }),
    db.link.update({ where: { id: link.id }, data: { clicks: { increment: 1 }, uniqueClicks: { increment: isUnique ? 1 : 0 } } }),
  ]);
  if (link.userId) dispatchWebhooks(link.userId, "link.clicked", { id: link.id, alias: link.alias, country: v.countryCode, device: v.device, referer: v.refererHost }).catch(() => {});
}

export async function recordBioView(bioPageId: string, v: VisitorInfo) {
  const s = await getSettings();
  const ip = s["misc.anonymousStats"] === "1" ? null : v.ip;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const prev = await db.click.findFirst({ where: { bioPageId, ipHash: v.ipHash, createdAt: { gte: since } }, select: { id: true } });
  await db.$transaction([
    db.click.create({ data: { bioPageId, ip, ipHash: v.ipHash, country: v.country, countryCode: v.countryCode, region: v.region, city: v.city, lat: v.lat, lng: v.lng, referer: v.referer?.slice(0, 500), refererHost: v.refererHost, userAgent: v.userAgent, browser: v.browser, os: v.os, device: v.device, language: v.language, isUnique: !prev, isBot: v.isBot } }),
    db.bioPage.update({ where: { id: bioPageId }, data: { views: { increment: 1 }, uniqueViews: { increment: prev ? 0 : 1 } } }),
  ]);
}

export async function recordQrScan(qrCodeId: string, v: VisitorInfo) {
  const s = await getSettings();
  const ip = s["misc.anonymousStats"] === "1" ? null : v.ip;
  await db.$transaction([
    db.click.create({ data: { qrCodeId, ip, ipHash: v.ipHash, country: v.country, countryCode: v.countryCode, region: v.region, city: v.city, lat: v.lat, lng: v.lng, referer: v.referer?.slice(0, 500), refererHost: v.refererHost, userAgent: v.userAgent, browser: v.browser, os: v.os, device: v.device, language: v.language, isBot: v.isBot } }),
    db.qrCode.update({ where: { id: qrCodeId }, data: { scans: { increment: 1 } } }),
  ]);
}
