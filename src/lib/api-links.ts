import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { createLink, updateLink, LinkError, type LinkInput } from "./links";
import { dispatchWebhooks } from "./webhooks";
import { ApiRequestError, asArray, asBool, asNumber, asRecord, asString, asStringArray, asStringRecord, isRecord, paginate, type Pagination } from "./api-helpers";
import { serializeLink, type LinkWithRelations } from "./api-serializers";

export const LINK_INCLUDE = { domain: true, pixels: { include: { pixel: true } } } satisfies Prisma.LinkInclude;

/** Resolves a domain given an id or a hostname; verifies the user may use it. */
export async function resolveDomainId(value: unknown, userId: string, isAdmin: boolean): Promise<string | null | undefined> {
  const s = asString(value)?.trim();
  if (s === undefined) return undefined;
  if (!s) return null;
  const host = s.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  const domain = await db.domain.findFirst({ where: { OR: [{ id: s }, { domain: host }] } });
  if (!domain) throw new ApiRequestError("Domain not found", 404);
  if (!domain.isPublic && domain.userId !== userId && !isAdmin) throw new ApiRequestError("You cannot use this domain", 403);
  return domain.id;
}

/** Accepts `[{country,url}]` or the legacy `{"US":"https://..."}` object shape. */
function targets(v: unknown, key: string): unknown[] | undefined {
  const arr = asArray(v);
  if (arr) return arr.filter(isRecord);
  const rec = asRecord(v);
  if (rec) return Object.entries(rec).map(([k, url]) => ({ [key]: k, url: asString(url) ?? "" })).filter((t) => t.url);
  if (v === null) return [];
  return undefined;
}

async function ownedId(model: "campaign" | "channel" | "splashPage" | "overlay", value: unknown, userId: string, isAdmin: boolean): Promise<string | null | undefined> {
  const s = asString(value)?.trim();
  if (s === undefined) return undefined;
  if (!s) return null;
  let row: { id: string; userId: string } | null = null;
  if (model === "campaign") row = await db.campaign.findFirst({ where: { OR: [{ id: s }, { slug: s }] }, select: { id: true, userId: true } });
  if (model === "channel") row = await db.channel.findFirst({ where: { OR: [{ id: s }, { name: s, userId }] }, select: { id: true, userId: true } });
  if (model === "splashPage") row = await db.splashPage.findFirst({ where: { id: s }, select: { id: true, userId: true } });
  if (model === "overlay") row = await db.overlay.findFirst({ where: { id: s }, select: { id: true, userId: true } });
  if (!row) throw new ApiRequestError(`${model === "splashPage" ? "Splash page" : model[0].toUpperCase() + model.slice(1)} not found`, 404);
  if (row.userId !== userId && !isAdmin) throw new ApiRequestError("Forbidden", 403);
  return row.id;
}

/** Maps the public API body (legacy + modern field names) onto `LinkInput`. */
export async function linkInputFromBody(body: Record<string, unknown>, userId: string, isAdmin: boolean, partial = false): Promise<Partial<LinkInput> & { channelId?: string | null }> {
  const input: Partial<LinkInput> & { channelId?: string | null } = {};
  const url = asString(body.url ?? body.longUrl ?? body.long_url);
  if (url !== undefined) input.url = url;
  else if (!partial) throw new ApiRequestError("Missing required parameter: url");

  const alias = asString(body.custom ?? body.alias);
  if (alias !== undefined) input.alias = alias;
  const domainId = await resolveDomainId(body.domain ?? body.domainId, userId, isAdmin);
  if (domainId !== undefined) input.domainId = domainId;

  const type = asString(body.type ?? body.redirectType ?? body.redirect);
  if (type !== undefined) {
    if (!["direct", "frame", "splash", "custom", "overlay"].includes(type)) throw new ApiRequestError("Invalid redirect type. Use direct, frame, splash, custom or overlay");
    input.redirectType = type;
  }
  const splashId = await ownedId("splashPage", body.splash ?? body.splashId, userId, isAdmin);
  if (splashId !== undefined) { input.splashId = splashId; if (splashId && input.redirectType === undefined && !partial) input.redirectType = "custom"; }
  const overlayId = await ownedId("overlay", body.overlay ?? body.overlayId, userId, isAdmin);
  if (overlayId !== undefined) { input.overlayId = overlayId; if (overlayId && input.redirectType === undefined && !partial) input.redirectType = "overlay"; }

  for (const k of ["title", "description", "image", "notes", "expiredUrl", "clickLimitUrl"] as const) {
    const v = body[k] ?? (k === "expiredUrl" ? body.expired_url ?? body.expiryUrl : k === "clickLimitUrl" ? body.click_limit_url : undefined);
    if (v === null) input[k] = null;
    else { const s = asString(v); if (s !== undefined) input[k] = s; }
  }
  if ("password" in body) input.password = asString(body.password) || null;
  const expiry = body.expiry ?? body.expiresAt ?? body.expires_at ?? body.expire;
  if (expiry !== undefined) {
    if (expiry === null || expiry === "") input.expiresAt = null;
    else {
      const s = asString(expiry) ?? "";
      const d = new Date(/^\d+$/.test(s) ? Number(s) * (s.length <= 10 ? 1000 : 1) : s);
      if (isNaN(d.getTime())) throw new ApiRequestError("Invalid expiry date");
      input.expiresAt = d;
    }
  }
  const clickLimit = body.clickLimit ?? body.click_limit ?? body.maxClicks;
  if (clickLimit !== undefined) input.clickLimit = clickLimit === null ? null : asNumber(clickLimit) ?? null;

  const geo = targets(body.geotarget ?? body.geoTargets ?? body.geo, "country");
  if (geo) input.geoTargets = geo;
  const dev = targets(body.devicetarget ?? body.deviceTargets ?? body.device, "device");
  if (dev) input.deviceTargets = dev;
  const lang = targets(body.languagetarget ?? body.langTargets ?? body.languageTargets ?? body.language, "lang");
  if (lang) input.langTargets = lang;
  const time = targets(body.timetarget ?? body.timeTargets, "from");
  if (time) input.timeTargets = time;
  const conditions = asArray(body.conditions);
  if (conditions) input.conditions = conditions.filter(isRecord);
  const ab = asArray(body.abUrls ?? body.ab ?? body.variants);
  if (ab) input.abUrls = ab.map((x) => (isRecord(x) ? x : { url: asString(x) ?? "" })).filter((x) => asString(x.url));
  const rotator = asString(body.rotatorMode ?? body.rotator);
  if (rotator !== undefined) input.rotatorMode = rotator;

  const deep = body.deeplink ?? body.deepLink ?? body.deepLinkConfig;
  if (deep !== undefined) {
    const cfg = asRecord(deep);
    const on = asBool(deep);
    if (cfg) { input.deepLink = true; input.deepLinkConfig = cfg; }
    else if (on !== undefined) { input.deepLink = on; if (!on) input.deepLinkConfig = {}; }
  }
  const utm = asStringRecord(body.utm);
  if (utm) input.utm = utm;
  else if (asString(body.utm_source) || asString(body.utm_medium) || asString(body.utm_campaign)) {
    input.utm = { source: asString(body.utm_source) ?? "", medium: asString(body.utm_medium) ?? "", campaign: asString(body.utm_campaign) ?? "", term: asString(body.utm_term) ?? "", content: asString(body.utm_content) ?? "" };
  }
  const params = asStringRecord(body.params ?? body.customParams ?? body.parameters);
  if (params) input.customParams = params;
  for (const [src, dst] of [["forwardParams", "forwardParams"], ["cloaking", "cloaking"], ["botBlock", "botBlock"], ["inAppBreakout", "inAppBreakout"], ["isPublic", "isPublic"]] as const) {
    const v = asBool(body[src] ?? body[src.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())]);
    if (v !== undefined) input[dst] = v;
  }
  if (body.public !== undefined && input.isPublic === undefined) input.isPublic = asBool(body.public);

  const campaignId = await ownedId("campaign", body.campaign ?? body.campaignId, userId, isAdmin);
  if (campaignId !== undefined) input.campaignId = campaignId;
  const channelId = await ownedId("channel", body.channel ?? body.channelId, userId, isAdmin);
  if (channelId !== undefined) input.channelId = channelId;

  const pixels = asStringArray(body.pixels ?? body.pixelIds);
  if (pixels) {
    const owned = await db.pixel.findMany({ where: { id: { in: pixels }, ...(isAdmin ? {} : { userId }) }, select: { id: true } });
    if (owned.length !== pixels.length) throw new ApiRequestError("One or more pixels were not found", 404);
    input.pixelIds = owned.map((p) => p.id);
  }
  return input;
}

export async function loadLink(id: string, userId: string, isAdmin: boolean): Promise<LinkWithRelations> {
  const link = await db.link.findFirst({ where: { OR: [{ id }, { alias: id, ...(isAdmin ? {} : { userId }) }] }, include: LINK_INCLUDE });
  if (!link) throw new ApiRequestError("Link not found", 404);
  if (!isAdmin && link.userId !== userId) throw new ApiRequestError("Link not found", 404);
  return link;
}

export interface LinkListQuery { search?: string; order?: string; campaign?: string; channel?: string; domain?: string; status?: string; archived?: boolean }

export function linkListQuery(req: NextRequest): LinkListQuery & { pagination: Pagination } {
  const q = req.nextUrl.searchParams;
  return {
    search: q.get("search") || q.get("q") || undefined, order: q.get("order") || q.get("sort") || "date",
    campaign: q.get("campaign") || undefined, channel: q.get("channel") || undefined, domain: q.get("domain") || undefined,
    status: q.get("status") || undefined, archived: q.get("archived") === "1" || q.get("archived") === "true", pagination: paginate(req),
  };
}

export async function listLinks(userId: string, q: LinkListQuery, p: Pagination) {
  const where: Prisma.LinkWhereInput = { userId };
  if (q.search) where.OR = [{ alias: { contains: q.search } }, { url: { contains: q.search } }, { title: { contains: q.search } }];
  if (q.campaign) where.campaignId = q.campaign;
  if (q.channel) where.channelId = q.channel;
  if (q.domain) where.domain = q.domain === "main" ? undefined : { OR: [{ id: q.domain }, { domain: q.domain }] };
  if (q.domain === "main") where.domainId = null;
  if (q.status === "archived") where.isArchived = true;
  else { where.isArchived = q.archived ? undefined : false; if (q.status) where.status = q.status; }
  const orderBy: Prisma.LinkOrderByWithRelationInput = q.order === "clicks" ? { clicks: "desc" } : q.order === "alias" ? { alias: "asc" } : { createdAt: "desc" };
  const [rows, total] = await Promise.all([
    db.link.findMany({ where, orderBy, skip: p.skip, take: p.limit, include: LINK_INCLUDE }),
    db.link.count({ where }),
  ]);
  return { data: rows.map(serializeLink), total };
}

export async function apiCreateLink(body: Record<string, unknown>, userId: string, isAdmin: boolean, ip?: string) {
  const { channelId, ...input } = await linkInputFromBody(body, userId, isAdmin);
  if (!input.url) throw new ApiRequestError("Missing required parameter: url");
  const created = await createLink(userId, { ...input, url: input.url }, { ip });
  if (channelId) await db.link.update({ where: { id: created.id }, data: { channelId } });
  const full = await db.link.findUnique({ where: { id: created.id }, include: LINK_INCLUDE });
  return serializeLink(full ?? created);
}

export async function apiUpdateLink(id: string, body: Record<string, unknown>, userId: string, isAdmin: boolean) {
  const link = await loadLink(id, userId, isAdmin);
  const { channelId, ...input } = await linkInputFromBody(body, userId, isAdmin, true);
  await updateLink(link.id, userId, input, isAdmin);
  const extra: Prisma.LinkUpdateInput = {};
  if (channelId !== undefined) extra.channel = channelId ? { connect: { id: channelId } } : { disconnect: true };
  const archived = asBool(body.archived ?? body.isArchived);
  if (archived !== undefined) extra.isArchived = archived;
  const pinned = asBool(body.pinned ?? body.isPinned);
  if (pinned !== undefined) extra.isPinned = pinned;
  if (isAdmin) { const status = asString(body.status); if (status && ["active", "pending", "disabled", "blocked"].includes(status)) extra.status = status; }
  const updated = await db.link.update({ where: { id: link.id }, data: extra, include: LINK_INCLUDE });
  return serializeLink(updated);
}

export async function apiDeleteLink(id: string, userId: string, isAdmin: boolean) {
  const link = await loadLink(id, userId, isAdmin);
  await db.link.delete({ where: { id: link.id } });
  dispatchWebhooks(link.userId, "link.deleted", { id: link.id, alias: link.alias, url: link.url }).catch(() => {});
  return { id: link.id, alias: link.alias };
}

export { LinkError };
