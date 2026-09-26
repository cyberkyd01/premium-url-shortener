import type { BioBlock, BioPage, Campaign, Channel, Domain, HostedFile, Link, LinkPixel, Overlay, Payment, Pixel, Plan, QrCode, SplashPage, Subscription, Team, TeamMember, User, Webhook } from "@prisma/client";
import { parseLinkJson, shortUrl } from "./links";
import { appUrl, json } from "./utils";
import { planFeatures } from "./plan";
import { qrPayload, qrTarget } from "./qr";

export type LinkWithRelations = Link & { domain?: Domain | null; pixels?: (LinkPixel & { pixel?: Pixel | null })[] };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Public JSON shape of a short link used by every API v1 endpoint. */
export function serializeLink(link: LinkWithRelations) {
  const p = parseLinkJson(link);
  return {
    id: link.id,
    alias: link.alias,
    short: shortUrl(link),
    url: link.url,
    title: link.title,
    description: link.description,
    image: link.image,
    domain: link.domain ? link.domain.domain : null,
    domainId: link.domainId,
    clicks: link.clicks,
    uniqueClicks: link.uniqueClicks,
    redirectType: link.redirectType,
    splashId: link.splashId,
    overlayId: link.overlayId,
    password: !!link.password,
    expiresAt: iso(link.expiresAt),
    expiredUrl: link.expiredUrl,
    clickLimit: link.clickLimit,
    clickLimitUrl: link.clickLimitUrl,
    campaignId: link.campaignId,
    channelId: link.channelId,
    pixels: (link.pixels ?? []).map((lp) => (lp.pixel ? { id: lp.pixel.id, name: lp.pixel.name, provider: lp.pixel.provider } : { id: lp.pixelId })),
    geoTargets: p.geoTargets,
    deviceTargets: p.deviceTargets,
    langTargets: p.langTargets,
    timeTargets: p.timeTargets,
    conditions: p.conditions,
    abUrls: p.abUrls,
    rotatorMode: link.rotatorMode,
    utm: p.utm,
    customParams: p.customParams,
    forwardParams: link.forwardParams,
    deepLink: link.deepLink ? p.deepLinkConfig : false,
    cloaking: link.cloaking,
    botBlock: link.botBlock,
    inAppBreakout: link.inAppBreakout,
    isPublic: link.isPublic,
    isArchived: link.isArchived,
    isPinned: link.isPinned,
    status: link.status,
    notes: link.notes,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

export type SerializedLink = ReturnType<typeof serializeLink>;

export function serializeCampaign(c: Campaign & { _count?: { links: number } }) {
  return {
    id: c.id, name: c.name, slug: c.slug, description: c.description, color: c.color,
    isRotator: c.isRotator, rotatorAlias: c.rotatorAlias, rotatorUrl: c.rotatorAlias ? appUrl("/" + c.rotatorAlias) : null, rotatorMode: c.rotatorMode,
    isPublic: c.isPublic, publicUrl: c.isPublic ? appUrl("/campaign/" + c.slug) : null, links: c._count?.links ?? undefined,
    createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeChannel(c: Channel & { _count?: { links: number; bioPages: number; qrCodes: number } }) {
  return {
    id: c.id, name: c.name, color: c.color, starred: c.starred,
    counts: c._count ? { links: c._count.links, bio: c._count.bioPages, qr: c._count.qrCodes } : undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializePixel(p: Pixel & { _count?: { links: number } }) {
  return { id: p.id, name: p.name, provider: p.provider, pixelId: p.pixelId, links: p._count?.links ?? undefined, createdAt: p.createdAt.toISOString() };
}

export function serializeDomain(d: Domain & { _count?: { links: number } }, ownerId?: string | null) {
  return {
    id: d.id, domain: d.domain, rootRedirect: d.rootRedirect, notFoundRedirect: d.notFoundRedirect,
    status: d.status === 1 ? "active" : "pending", isPublic: d.isPublic, isMain: d.isMain, verifyToken: ownerId && d.userId === ownerId ? d.verifyToken : undefined,
    own: ownerId ? d.userId === ownerId : undefined, links: d._count?.links ?? undefined, createdAt: d.createdAt.toISOString(),
  };
}

export function serializeSplash(s: SplashPage & { _count?: { links: number } }) {
  return { id: s.id, name: s.name, title: s.title, description: s.description, countdown: s.countdown, isDefault: s.isDefault, links: s._count?.links ?? undefined, createdAt: s.createdAt.toISOString() };
}

export function serializeOverlay(o: Overlay & { _count?: { links: number } }) {
  return { id: o.id, name: o.name, type: o.type, position: o.position, title: o.title, message: o.message, links: o._count?.links ?? undefined, createdAt: o.createdAt.toISOString() };
}

export function serializeQr(q: QrCode & { link?: (Link & { domain?: Domain | null }) | null }) {
  const short = q.link ? shortUrl(q.link) : null;
  return {
    id: q.id, name: q.name, type: q.type, data: json<Record<string, string>>(q.data, {}),
    content: qrPayload(q, { shortUrl: short }), target: qrTarget(q, { shortUrl: short }),
    dynamic: q.isDynamic, alias: q.alias, scanUrl: q.alias ? appUrl("/" + q.alias) : null,
    linkId: q.linkId, short, bioPageId: q.bioPageId, channelId: q.channelId,
    style: json<Record<string, unknown>>(q.style, {}), image: q.image ? (q.image.startsWith("http") ? q.image : appUrl(q.image)) : appUrl(`/api/qr/${q.id}/download?format=svg`),
    scans: q.scans, createdAt: q.createdAt.toISOString(), updatedAt: q.updatedAt.toISOString(),
  };
}

export function serializeBioBlock(b: BioBlock) {
  return {
    id: b.id, type: b.type, title: b.title, url: b.url, content: json<Record<string, unknown>>(b.content, {}), thumbnail: b.thumbnail,
    order: b.order, clicks: b.clicks, enabled: b.enabled, scheduleStart: iso(b.scheduleStart), scheduleEnd: iso(b.scheduleEnd),
    countries: json<string[]>(b.countries, []), languages: json<string[]>(b.languages, []), sensitive: b.sensitive, gated: b.gated, animation: b.animation,
    createdAt: b.createdAt.toISOString(),
  };
}

export function serializeBio(p: BioPage & { domain?: Domain | null; blocks?: BioBlock[]; _count?: { blocks: number } }) {
  return {
    id: p.id, alias: p.alias, url: p.domain ? `https://${p.domain.domain}/${p.alias}` : appUrl("/" + p.alias), domain: p.domain?.domain ?? null,
    name: p.name, bio: p.bio, avatar: p.avatar, cover: p.cover, verified: p.verified, theme: p.theme, layout: p.layout, buttonStyle: p.buttonStyle, font: p.font,
    colors: json<Record<string, unknown>>(p.colors, {}), seo: json<Record<string, unknown>>(p.seo, {}), socials: json<unknown[]>(p.socials, []),
    password: !!p.password, ageGate: p.ageGate, sensitive: p.sensitive, isDefault: p.isDefault, status: p.status, channelId: p.channelId,
    views: p.views, uniqueViews: p.uniqueViews, blocks: p.blocks ? p.blocks.map(serializeBioBlock) : undefined, blockCount: p._count?.blocks ?? p.blocks?.length,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeFile(f: HostedFile) {
  return {
    id: f.id, alias: f.alias, url: appUrl("/" + f.alias), name: f.name, size: f.size, mime: f.mime, password: !!f.password,
    expiresAt: iso(f.expiresAt), encrypted: f.encrypted, downloads: f.downloads, createdAt: f.createdAt.toISOString(),
  };
}

export function serializePlan(p: Plan) {
  const limits: Record<string, number> = {};
  for (const [k, v] of Object.entries(p)) if (k.startsWith("limit") && typeof v === "number") limits[k] = v;
  return {
    id: p.id, name: p.name, slug: p.slug, description: p.description, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, priceLifetime: p.priceLifetime,
    currency: p.currency, isFree: p.isFree, isPublic: p.isPublic, isFeatured: p.isFeatured, trialDays: p.trialDays, limits, features: planFeatures(p),
  };
}

/** Profile shape (own account or admin listing). */
export function serializeUser(u: User & { plan?: Plan | null }, opts: { admin?: boolean } = {}) {
  return {
    id: u.id, username: u.username, email: u.email, name: u.name, avatar: u.avatar, role: u.role, status: u.status === 1 ? "active" : u.status === 0 ? "banned" : "pending",
    language: u.language, timezone: u.timezone, verified: u.verified, isPublic: u.isPublic, twoFactorEnabled: u.twoFactorEnabled,
    plan: u.plan ? { id: u.plan.id, name: u.plan.name, slug: u.plan.slug, isFree: u.plan.isFree } : null,
    planId: u.planId, planExpires: iso(u.planExpires), planTrialEnds: iso(u.planTrialEnds),
    aiCredits: u.aiCredits, storageUsed: u.storageUsed, affiliateCode: u.affiliateCode, affiliateBalance: opts.admin ? u.affiliateBalance : undefined,
    lastLoginAt: opts.admin ? iso(u.lastLoginAt) : undefined, lastLoginIp: opts.admin ? u.lastLoginIp : undefined,
    createdAt: u.createdAt.toISOString(),
  };
}

export function serializePayment(p: Payment & { user?: Pick<User, "id" | "username" | "email"> | null; plan?: Plan | null }) {
  return {
    id: p.id, userId: p.userId, user: p.user ? { id: p.user.id, username: p.user.username, email: p.user.email } : undefined,
    planId: p.planId, plan: p.plan ? { id: p.plan.id, name: p.plan.name, slug: p.plan.slug } : null, gateway: p.gateway, transactionId: p.transactionId,
    amount: p.amount, tax: p.tax, discount: p.discount, currency: p.currency, interval: p.interval, status: p.status, couponCode: p.couponCode,
    invoiceNumber: p.invoiceNumber, createdAt: p.createdAt.toISOString(),
  };
}

export function serializeSubscription(s: Subscription & { plan?: Plan | null }) {
  return { id: s.id, planId: s.planId, plan: s.plan ? { id: s.plan.id, name: s.plan.name, slug: s.plan.slug } : null, gateway: s.gateway, interval: s.interval, status: s.status, currentPeriodEnd: iso(s.currentPeriodEnd), cancelAt: iso(s.cancelAt), createdAt: s.createdAt.toISOString() };
}

export function serializeTeam(t: Team & { owner?: Pick<User, "id" | "username" | "email"> | null; members?: (TeamMember & { user?: Pick<User, "id" | "username" | "email"> | null })[]; _count?: { members: number } }, viewerId: string) {
  return {
    id: t.id, name: t.name, ownerId: t.ownerId, owner: t.owner ? { id: t.owner.id, username: t.owner.username, email: t.owner.email } : undefined,
    role: t.ownerId === viewerId ? "owner" : t.members?.find((m) => m.userId === viewerId)?.role ?? "member",
    members: t.members?.map((m) => ({ id: m.id, userId: m.userId, username: m.user?.username, email: m.user?.email, role: m.role, permissions: json<Record<string, string[]>>(m.permissions, {}), joinedAt: m.createdAt.toISOString() })),
    memberCount: t._count?.members ?? t.members?.length, createdAt: t.createdAt.toISOString(),
  };
}

export function serializeWebhook(w: Webhook) {
  return { id: w.id, name: w.name, url: w.url, events: json<string[]>(w.events, []), provider: w.provider, active: w.active, lastCalledAt: iso(w.lastCalledAt), createdAt: w.createdAt.toISOString() };
}
