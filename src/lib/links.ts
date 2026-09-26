import { db } from "./db";
import { getSettings } from "./settings";
import { getUserPlan, withinLimit, type PlanFeatures } from "./plan";
import { isValidAlias, isValidUrl, normalizeUrl, randomAlias, hostOf, json, appUrl } from "./utils";
import { dispatchWebhooks } from "./webhooks";
import bcrypt from "bcryptjs";
import { notifyAdmins } from "./notify";
import { checkUrlAllowed, checkShortenAllowed } from "./security";

export interface LinkInput {
  url: string;
  alias?: string | null;
  domainId?: string | null;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  redirectType?: string;
  splashId?: string | null;
  overlayId?: string | null;
  password?: string | null;
  expiresAt?: string | Date | null;
  expiredUrl?: string | null;
  clickLimit?: number | null;
  clickLimitUrl?: string | null;
  geoTargets?: unknown[];
  deviceTargets?: unknown[];
  langTargets?: unknown[];
  timeTargets?: unknown[];
  conditions?: unknown[];
  abUrls?: unknown[];
  rotatorMode?: string;
  deepLink?: boolean;
  deepLinkConfig?: Record<string, unknown>;
  utm?: Record<string, string>;
  customParams?: Record<string, string>;
  forwardParams?: boolean;
  cloaking?: boolean;
  botBlock?: boolean;
  inAppBreakout?: boolean;
  pixelIds?: string[];
  campaignId?: string | null;
  isPublic?: boolean;
  notes?: string | null;
  teamId?: string | null;
  /** Comma-separated list is stored; accepts an array or a string. */
  tags?: string[] | string | null;
  /** Scheduled go-live: the link returns a "scheduled" page until this date. */
  activateAt?: string | Date | null;
  /** ISO country codes that receive a 404. */
  blockCountries?: string[] | null;
  /** IPs or CIDR / prefix patterns that receive a 404. */
  blockIps?: string[] | null;
  /** Used as the destination when the health checker marks the link as broken. */
  fallbackUrl?: string | null;
  /** Notify the owner once clicks reach this number. */
  alertThreshold?: number | null;
}

/** Normalizes a tag list (array or comma-separated string) into a clean, unique, lowercase-insensitive array. */
export function normalizeTags(input: string[] | string | null | undefined): string[] {
  const raw = Array.isArray(input) ? input : (input ?? "").split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const v = t.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= 20) break;
  }
  return out;
}

export function parseTags(tags: string | null | undefined): string[] {
  return normalizeTags(tags ?? "");
}

function cleanList(input: string[] | null | undefined, max = 200) {
  return [...new Set((input ?? []).map((v) => v.trim()).filter(Boolean))].slice(0, max);
}

export class LinkError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const BLOCKLIST_HOSTS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy"];

/** URL validation + filtering: format, blocked domains/words, same-domain loops, Google Web Risk, PhishTank. */
export async function validateUrl(url: string) {
  const s = await getSettings();
  if (!isValidUrl(url)) throw new LinkError("Please enter a valid URL");
  const host = hostOf(url);
  if (!host && !/^(mailto|tel|sms):/.test(url)) throw new LinkError("Please enter a valid URL");
  if (s["links.allowSameDomain"] !== "1") {
    const app = hostOf(appUrl());
    if (host === app) throw new LinkError("You cannot shorten a link from this site");
    const own = await db.domain.findMany({ select: { domain: true } });
    if (own.some((d) => d.domain === host)) throw new LinkError("You cannot shorten a link from this site");
  }
  if (s["links.filter"] === "1") {
    const blockedDomains = [...(s["links.blockedDomains"] || "").split(/[\n,]/), ...BLOCKLIST_HOSTS].map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (blockedDomains.some((d) => host === d || host.endsWith("." + d))) throw new LinkError("This domain is not allowed");
    const dbBlocked = await db.blockedItem.findMany({ where: { type: { in: ["domain", "word"] } } });
    for (const b of dbBlocked) {
      if (b.type === "domain" && (host === b.value || host.endsWith("." + b.value))) throw new LinkError("This domain is not allowed");
      if (b.type === "word" && url.toLowerCase().includes(b.value.toLowerCase())) throw new LinkError("This URL contains blocked content");
    }
    const words = (s["links.blockedWords"] || "").split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (words.some((w) => url.toLowerCase().includes(w))) throw new LinkError("This URL contains blocked content");
  }
  if (s["links.webrisk"] === "1") {
    const key = s["links.webriskKey"] || process.env.GOOGLE_WEBRISK_API_KEY;
    if (key) {
      try {
        const q = new URLSearchParams({ key, uri: url });
        for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) q.append("threatTypes", t);
        const r = await fetch("https://webrisk.googleapis.com/v1/uris:search?" + q);
        const d = (await r.json()) as { threat?: unknown };
        if (d.threat) throw new LinkError("This URL was flagged as unsafe");
      } catch (e) { if (e instanceof LinkError) throw e; }
    }
  }
  if (s["links.phishtank"] === "1") {
    try {
      const r = await fetch("https://checkurl.phishtank.com/checkurl/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ url, format: "json" }) });
      const d = (await r.json()) as { results?: { in_database?: boolean; valid?: boolean } };
      if (d.results?.in_database && d.results.valid) throw new LinkError("This URL was reported as phishing");
    } catch (e) { if (e instanceof LinkError) throw e; }
  }
  // Built-in add-ons (Whitelist Domains, URLhaus, Google Safe Browsing) — only enforced while active.
  const addon = await checkUrlAllowed(url);
  if (!addon.ok) throw new LinkError(addon.reason ?? "This URL is not allowed");
  return true;
}

export async function isAliasAvailable(alias: string, domainId: string | null, excludeId?: string) {
  const s = await getSettings();
  const reserved = (s["links.reservedAliases"] || "").split(",").map((r) => r.trim());
  if (reserved.includes(alias.toLowerCase())) return false;
  const blocked = await db.blockedItem.findFirst({ where: { type: "alias", value: alias.toLowerCase() } });
  if (blocked) return false;
  const existing = await db.link.findFirst({ where: { alias, domainId, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (existing) return false;
  if (!domainId) {
    const bio = await db.bioPage.findFirst({ where: { alias, domainId: null } });
    if (bio) return false;
    const page = await db.page.findUnique({ where: { slug: alias } });
    if (page) return false;
    const user = await db.user.findUnique({ where: { username: alias } });
    if (user) return false;
  }
  return true;
}

export async function generateAlias(domainId: string | null) {
  const s = await getSettings();
  const len = parseInt(s["links.aliasLength"] || "6", 10);
  for (let i = 0; i < 20; i++) {
    const a = s["links.aliasType"] === "numeric" ? String(Math.floor(Math.random() * 10 ** len)).padStart(len, "1") : randomAlias(len + (i > 10 ? 1 : 0));
    if (await isAliasAvailable(a, domainId)) return a;
  }
  throw new LinkError("Could not generate alias");
}

async function requireFeature(features: PlanFeatures, isAdmin: boolean, key: keyof PlanFeatures, label: string) {
  if (isAdmin) return;
  if (!features[key]) throw new LinkError(`${label} is not available on your plan. Please upgrade.`, 402);
}

/** Creates a short link for a user or anonymously. Enforces plan limits & features, filtering and approval. */
export async function createLink(userId: string | null, input: LinkInput, opts: { ip?: string; countryCode?: string | null; skipLimits?: boolean } = {}) {
  const s = await getSettings();
  const url = normalizeUrl(input.url);
  await validateUrl(url);
  if (opts.ip || opts.countryCode) {
    // Built-in add-ons (Ban IP Addresses, Block Countries); checks are skipped when the value is unknown.
    const gate = await checkShortenAllowed({ ip: opts.ip, countryCode: opts.countryCode });
    if (!gate.ok) throw new LinkError(gate.reason ?? "You are not allowed to shorten links", 403);
  }
  let features: PlanFeatures | null = null;
  let isAdmin = false;
  if (userId) {
    const up = await getUserPlan(userId);
    features = up.features;
    isAdmin = up.user.role === "admin";
    if (!opts.skipLimits && !isAdmin) {
      const total = await withinLimit(userId, "limitLinks");
      if (!total.ok) throw new LinkError(`You have reached your plan limit of ${total.limit} links.`, 402);
      const monthly = await withinLimit(userId, "limitLinksMonthly");
      if (!monthly.ok) throw new LinkError(`You have reached your monthly limit of ${monthly.limit} links.`, 402);
    }
  } else {
    if (s["links.anonymous"] !== "1" || s["site.private"] === "1") throw new LinkError("Please login to shorten links", 401);
  }
  const domainId = input.domainId || null;
  if (domainId) {
    const domain = await db.domain.findUnique({ where: { id: domainId } });
    if (!domain || domain.status !== 1) throw new LinkError("Invalid domain");
    if (!domain.isPublic && domain.userId !== userId && !isAdmin) throw new LinkError("Invalid domain");
  } else if (s["domains.mainUsable"] !== "1" && userId && !isAdmin) {
    throw new LinkError("Please select a custom domain");
  }
  let alias = (input.alias || "").trim();
  if (alias) {
    if (!isValidAlias(alias)) throw new LinkError("Alias may only contain letters, numbers, dashes and underscores");
    if (!userId && s["links.customAlias"] !== "1") throw new LinkError("Custom aliases require an account", 401);
    if (features) await requireFeature(features, isAdmin, "customAlias", "Custom alias");
    const premiumLen = parseInt(s["links.premiumAliasLength"] || "4", 10);
    if (alias.length < premiumLen && !isAdmin && !(features?.premiumAlias)) throw new LinkError(`Aliases shorter than ${premiumLen} characters are reserved for premium plans`, 402);
    if (!(await isAliasAvailable(alias, domainId))) throw new LinkError("This alias is already taken");
  } else {
    alias = await generateAlias(domainId);
  }
  const f = features;
  const redirectType = input.redirectType || s["links.defaultRedirect"] || "direct";
  if (f && !isAdmin && !f.redirectTypes.includes(redirectType)) throw new LinkError("This redirection type is not available on your plan", 402);
  if (f) {
    if (input.password) await requireFeature(f, isAdmin, "password", "Password protection");
    if (input.expiresAt) await requireFeature(f, isAdmin, "expiration", "Link expiration");
    if (input.activateAt) await requireFeature(f, isAdmin, "expiration", "Scheduled activation");
    if (input.blockCountries?.length || input.blockIps?.length) await requireFeature(f, isAdmin, "conditions", "Blocklists");
    if (input.clickLimit) await requireFeature(f, isAdmin, "clickLimit", "Click limit");
    if (input.geoTargets?.length) await requireFeature(f, isAdmin, "geoTargeting", "Geo targeting");
    if (input.deviceTargets?.length) await requireFeature(f, isAdmin, "deviceTargeting", "Device targeting");
    if (input.langTargets?.length) await requireFeature(f, isAdmin, "languageTargeting", "Language targeting");
    if (input.timeTargets?.length) await requireFeature(f, isAdmin, "timeTargeting", "Time targeting");
    if (input.conditions?.length) await requireFeature(f, isAdmin, "conditions", "Advanced targeting");
    if (input.abUrls?.length) await requireFeature(f, isAdmin, "abTesting", "A/B testing");
    if (input.deepLink) await requireFeature(f, isAdmin, "deepLinks", "Deep links");
    if (input.customParams && Object.keys(input.customParams).length) await requireFeature(f, isAdmin, "customParams", "Custom parameters");
    if (input.cloaking) await requireFeature(f, isAdmin, "cloaking", "Link cloaking");
    if (input.botBlock) await requireFeature(f, isAdmin, "botBlock", "Bot blocking");
    if (input.inAppBreakout) await requireFeature(f, isAdmin, "inAppBreakout", "In-app browser breakout");
    if (input.pixelIds?.length) await requireFeature(f, isAdmin, "pixels", "Pixels");
    if (input.image) await requireFeature(f, isAdmin, "metaTags", "Custom meta tags");
    if (redirectType === "custom") await requireFeature(f, isAdmin, "customSplash", "Custom splash pages");
    if (redirectType === "overlay") await requireFeature(f, isAdmin, "overlays", "Overlays");
  } else if (redirectType !== "direct" && s["links.anonymous"] === "1" && !["direct", "frame", "splash"].includes(redirectType)) {
    throw new LinkError("Please login to use this redirection type", 401);
  }
  const needsApproval = userId ? s["links.approvalUsers"] === "1" && !isAdmin : s["links.approval"] === "1";
  const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
  const status = needsApproval && !user?.verified ? "pending" : "active";
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : userId || !parseInt(s["links.anonymousExpiryDays"] || "0", 10) ? null : new Date(Date.now() + parseInt(s["links.anonymousExpiryDays"], 10) * 86400000);

  const link = await db.link.create({
    data: {
      alias, url, domainId, userId, teamId: input.teamId ?? null,
      title: input.title?.slice(0, 200) || null, description: input.description?.slice(0, 500) || null, image: input.image || null,
      redirectType, splashId: input.splashId || null, overlayId: input.overlayId || null,
      password: input.password ? await bcrypt.hash(input.password, 8) : null,
      expiresAt, expiredUrl: input.expiredUrl || null, clickLimit: input.clickLimit || null, clickLimitUrl: input.clickLimitUrl || null,
      geoTargets: JSON.stringify(input.geoTargets ?? []), deviceTargets: JSON.stringify(input.deviceTargets ?? []),
      langTargets: JSON.stringify(input.langTargets ?? []), timeTargets: JSON.stringify(input.timeTargets ?? []),
      conditions: JSON.stringify(input.conditions ?? []), abUrls: JSON.stringify(input.abUrls ?? []),
      rotatorMode: input.rotatorMode ?? (input.abUrls?.length ? "ab" : "none"),
      deepLink: !!input.deepLink, deepLinkConfig: JSON.stringify(input.deepLinkConfig ?? {}),
      utm: JSON.stringify(input.utm ?? {}), customParams: JSON.stringify(input.customParams ?? {}),
      forwardParams: !!input.forwardParams, cloaking: !!input.cloaking, botBlock: !!input.botBlock, inAppBreakout: !!input.inAppBreakout,
      campaignId: input.campaignId || null, isPublic: input.isPublic ?? true, notes: input.notes || null,
      tags: normalizeTags(input.tags).join(","), activateAt: input.activateAt ? new Date(input.activateAt) : null,
      blockCountries: JSON.stringify(cleanList(input.blockCountries).map((c) => c.toUpperCase())), blockIps: JSON.stringify(cleanList(input.blockIps)),
      fallbackUrl: input.fallbackUrl ? normalizeUrl(input.fallbackUrl) : null, alertThreshold: input.alertThreshold && input.alertThreshold > 0 ? Math.floor(input.alertThreshold) : null,
      status, isAnonymous: !userId, isPremiumAlias: alias.length < parseInt(s["links.premiumAliasLength"] || "4", 10),
      pixels: input.pixelIds?.length ? { create: input.pixelIds.map((pixelId) => ({ pixelId })) } : undefined,
    },
    include: { domain: true },
  });
  if (status === "pending") await notifyAdmins("Link awaiting approval", `${shortUrl(link)} needs approval`, "/admin/links?status=pending");
  if (userId) dispatchWebhooks(userId, "link.created", { id: link.id, alias: link.alias, short: shortUrl(link), url: link.url }).catch(() => {});
  return link;
}

export async function updateLink(linkId: string, userId: string | null, input: Partial<LinkInput>, isAdmin = false) {
  const link = await db.link.findUnique({ where: { id: linkId } });
  if (!link) throw new LinkError("Link not found", 404);
  if (!isAdmin && link.userId !== userId) throw new LinkError("Forbidden", 403);
  const data: Record<string, unknown> = {};
  if (input.url !== undefined) { const u = normalizeUrl(input.url); await validateUrl(u); data.url = u; }
  if (input.alias !== undefined && input.alias && input.alias !== link.alias) {
    if (!isValidAlias(input.alias)) throw new LinkError("Invalid alias");
    if (!(await isAliasAvailable(input.alias, link.domainId, link.id))) throw new LinkError("This alias is already taken");
    data.alias = input.alias;
  }
  const strFields = ["title", "description", "image", "redirectType", "splashId", "overlayId", "expiredUrl", "clickLimitUrl", "campaignId", "notes", "rotatorMode"] as const;
  for (const k of strFields) if (input[k] !== undefined) data[k] = input[k] || null;
  if (input.rotatorMode !== undefined) data.rotatorMode = input.rotatorMode || "none";
  if (input.redirectType !== undefined) data.redirectType = input.redirectType || "direct";
  if (input.password !== undefined) data.password = input.password ? await bcrypt.hash(input.password, 8) : null;
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.clickLimit !== undefined) data.clickLimit = input.clickLimit || null;
  if (input.tags !== undefined) data.tags = normalizeTags(input.tags).join(",");
  if (input.activateAt !== undefined) data.activateAt = input.activateAt ? new Date(input.activateAt) : null;
  if (input.blockCountries !== undefined) data.blockCountries = JSON.stringify(cleanList(input.blockCountries).map((c) => c.toUpperCase()));
  if (input.blockIps !== undefined) data.blockIps = JSON.stringify(cleanList(input.blockIps));
  if (input.fallbackUrl !== undefined) data.fallbackUrl = input.fallbackUrl ? normalizeUrl(input.fallbackUrl) : null;
  if (input.alertThreshold !== undefined) { data.alertThreshold = input.alertThreshold && input.alertThreshold > 0 ? Math.floor(input.alertThreshold) : null; if (data.alertThreshold !== link.alertThreshold) data.alertSentAt = null; }
  const jsonFields = ["geoTargets", "deviceTargets", "langTargets", "timeTargets", "conditions", "abUrls", "deepLinkConfig", "utm", "customParams"] as const;
  for (const k of jsonFields) if (input[k] !== undefined) data[k] = JSON.stringify(input[k] ?? (k.endsWith("s") && k !== "customParams" ? [] : {}));
  const boolFields = ["deepLink", "forwardParams", "cloaking", "botBlock", "inAppBreakout", "isPublic"] as const;
  for (const k of boolFields) if (input[k] !== undefined) data[k] = !!input[k];
  if (input.pixelIds !== undefined) {
    await db.linkPixel.deleteMany({ where: { linkId } });
    if (input.pixelIds.length) await db.linkPixel.createMany({ data: input.pixelIds.map((pixelId) => ({ linkId, pixelId })) });
  }
  const updated = await db.link.update({ where: { id: linkId }, data, include: { domain: true } });
  dispatchWebhooks(updated.userId, "link.updated", { id: updated.id, alias: updated.alias, url: updated.url }).catch(() => {});
  return updated;
}

export function shortUrl(link: { alias: string; domain?: { domain: string } | null }) {
  if (link.domain) return `https://${link.domain.domain}/${link.alias}`;
  return appUrl("/" + link.alias);
}

export function parseLinkJson(link: { geoTargets: string; deviceTargets: string; langTargets: string; timeTargets: string; conditions: string; abUrls: string; deepLinkConfig: string; utm: string; customParams: string }) {
  return {
    geoTargets: json<{ country: string; state?: string; url: string }[]>(link.geoTargets, []),
    deviceTargets: json<{ device: string; url: string }[]>(link.deviceTargets, []),
    langTargets: json<{ lang: string; url: string }[]>(link.langTargets, []),
    timeTargets: json<{ from: string; to: string; days?: number[]; timezone?: string; url: string }[]>(link.timeTargets, []),
    conditions: json<{ match: "all" | "any"; rules: { field: string; op: string; value: string }[]; url: string }[]>(link.conditions, []),
    abUrls: json<{ url: string; weight?: number }[]>(link.abUrls, []),
    deepLinkConfig: json<{ ios?: string; android?: string; fallback?: string; auto?: boolean; scheme?: string }>(link.deepLinkConfig, {}),
    utm: json<Record<string, string>>(link.utm, {}),
    customParams: json<Record<string, string>>(link.customParams, {}),
  };
}
