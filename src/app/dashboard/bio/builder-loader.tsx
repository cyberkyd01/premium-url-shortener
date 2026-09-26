import type { BioBlock, BioPage } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { appHost, appUrl, json } from "@/lib/utils";
import { COUNTRIES } from "@/lib/geo";
import { parseBioJson, bioUrl } from "@/lib/bio-widgets";
import type { Workspace } from "@/lib/workspace";
import { BioBuilder } from "@/components/bio/builder/bio-builder";
import type { BuilderOptions } from "@/components/bio/builder/settings-panels";
import type { BioPageInput, BioBlockInput } from "./actions";

export function pageToInput(p: BioPage): BioPageInput {
  const parsed = parseBioJson(p);
  return {
    name: p.name ?? "", bio: p.bio ?? "", avatar: p.avatar ?? "", cover: p.cover ?? "", alias: p.alias, domainId: p.domainId, channelId: p.channelId,
    theme: p.theme, layout: p.layout, buttonStyle: p.buttonStyle, font: p.font, colors: parsed.colors, customCss: p.customCss ?? "", customJs: p.customJs ?? "", customLogo: p.customLogo ?? "", hideBranding: p.hideBranding,
    seo: parsed.seo, socials: parsed.socials, socialsPosition: p.socialsPosition, socialIconStyle: p.socialIconStyle,
    password: p.password ?? "", ageGate: p.ageGate, sensitive: p.sensitive, newsletterGate: p.newsletterGate, nsfwWarning: p.nsfwWarning, pixelIds: parsed.pixelIds, contactEmail: p.contactEmail ?? "", status: p.status, listed: p.listed,
  };
}
export function blockToInput(b: BioBlock): BioBlockInput {
  return {
    id: b.id, clientId: b.id, type: b.type, title: b.title ?? "", url: b.url ?? "", thumbnail: b.thumbnail ?? "", content: json<Record<string, unknown>>(b.content, {}), order: b.order, enabled: b.enabled,
    scheduleStart: b.scheduleStart?.toISOString() ?? null, scheduleEnd: b.scheduleEnd?.toISOString() ?? null, countries: json<string[]>(b.countries, []), languages: json<string[]>(b.languages, []), sensitive: b.sensitive, gated: b.gated, animation: b.animation,
  };
}

/** Loads everything the client builder needs for a workspace and renders it. */
export async function BuilderScreen({ ws, page, blocks, suggestedAlias }: { ws: Workspace; page: BioPage | null; blocks: BioBlock[]; suggestedAlias?: string }) {
  const [s, { features, user }, domains, channels, pixels] = await Promise.all([
    getSettings(), getUserPlan(ws.ownerId),
    db.domain.findMany({ where: { status: 1, OR: [{ userId: ws.ownerId }, { isPublic: true }] }, select: { id: true, domain: true }, orderBy: { domain: "asc" } }),
    db.channel.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.pixel.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true, provider: true }, orderBy: { name: "asc" } }),
  ]);
  const isAdmin = ws.isAdmin || user.role === "admin";
  const options: BuilderOptions = {
    domains, channels, pixels, isAdmin, giphyEnabled: !!s["bio.giphyKey"], baseHost: appHost(), mainDomainAllowed: s["misc.mainDomainForBio"] !== "0" || isAdmin,
    features: { customCss: features.customCss, customLogo: features.customLogo, noBranding: features.noBranding, bioCustomDomain: features.bioCustomDomain, pixels: features.pixels },
  };
  const initialPage: BioPageInput = page ? pageToInput(page) : pageToInput({ ...emptyPage(ws.ownerId), alias: suggestedAlias ?? "", name: user.name ?? user.username, avatar: user.avatar });
  const domain = page?.domainId ? domains.find((d) => d.id === page.domainId) ?? null : null;
  const publicUrl = page ? bioUrl({ alias: page.alias, domain }, appUrl("/")) : appUrl("/" + initialPage.alias);
  return <BioBuilder pageId={page?.id ?? null} userId={ws.ownerId} initialPage={initialPage} initialBlocks={blocks.sort((a, b) => a.order - b.order).map(blockToInput)} options={options} siteName={s["site.name"]} publicUrl={publicUrl} countries={COUNTRIES} />;
}

function emptyPage(userId: string): BioPage {
  return {
    id: "", alias: "", domainId: null, userId, teamId: null, channelId: null, name: null, bio: null, avatar: null, cover: null, verified: false, theme: "default", layout: "centered", buttonStyle: "rounded", font: "Inter", colors: "{}", customCss: null, customJs: null, customLogo: null, hideBranding: false,
    seo: "{}", socials: "[]", socialsPosition: "bottom", socialIconStyle: "default", password: null, ageGate: null, sensitive: false, newsletterGate: false, nsfwWarning: false, isDefault: false, listed: false, isTemplate: false, templateName: null, status: "active", views: 0, uniqueViews: 0, pixelsJson: "[]", contactEmail: null, createdAt: new Date(), updatedAt: new Date(),
  };
}
