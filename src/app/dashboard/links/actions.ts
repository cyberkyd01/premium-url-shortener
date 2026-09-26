"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { createLink, updateLink, LinkError, shortUrl, isAliasAvailable, generateAlias, type LinkInput } from "@/lib/links";
import { assertLinkFeatures } from "@/lib/link-features";
import { aiComplete } from "@/lib/ai";
import { getStats } from "@/lib/stats";
import { clientIp, parseVisitor } from "@/lib/geo";
import { dispatchWebhooks } from "@/lib/webhooks";
import { isValidUrl, normalizeUrl } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import type { PlanFeatures } from "@/lib/plan";
import type { ActionState } from "@/components/ui/form-state";

import { linkPayloadSchema, type LinkPayload } from "@/components/links/link-schema";

function clean(p: LinkPayload): LinkInput {
  const nz = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const utm = Object.fromEntries(Object.entries(p.utm).filter(([, v]) => v.trim()));
  const customParams = Object.fromEntries(Object.entries(p.customParams).filter(([k, v]) => k.trim() && v.trim()));
  return {
    url: p.url.trim(), alias: p.alias.trim() || null, domainId: nz(p.domainId), title: nz(p.title), description: nz(p.description), image: nz(p.image),
    redirectType: p.redirectType || "direct", splashId: p.redirectType === "custom" ? nz(p.splashId) : null, overlayId: p.redirectType === "overlay" ? nz(p.overlayId) : null,
    expiresAt: nz(p.expiresAt), expiredUrl: nz(p.expiredUrl), clickLimit: p.clickLimit && p.clickLimit > 0 ? Math.floor(p.clickLimit) : null, clickLimitUrl: nz(p.clickLimitUrl),
    campaignId: nz(p.campaignId), pixelIds: p.pixelIds, utm, customParams, forwardParams: p.forwardParams,
    geoTargets: p.geoTargets.filter((r) => r.country && r.url.trim()).map((r) => ({ country: r.country.toUpperCase(), state: r.state?.trim() || undefined, url: normalizeUrl(r.url) })),
    deviceTargets: p.deviceTargets.filter((r) => r.device && r.url.trim()).map((r) => ({ device: r.device, url: normalizeUrl(r.url) })),
    langTargets: p.langTargets.filter((r) => r.lang && r.url.trim()).map((r) => ({ lang: r.lang.toLowerCase(), url: normalizeUrl(r.url) })),
    timeTargets: p.timeTargets.filter((r) => r.from && r.to && r.url.trim()).map((r) => ({ ...r, url: normalizeUrl(r.url) })),
    conditions: p.conditions.filter((c) => c.url.trim() && c.rules.some((r) => r.field)).map((c) => ({ ...c, rules: c.rules.filter((r) => r.field), url: normalizeUrl(c.url) })),
    abUrls: p.abUrls.filter((r) => r.url.trim()).map((r) => ({ url: normalizeUrl(r.url), weight: r.weight && r.weight > 0 ? r.weight : 1 })),
    rotatorMode: p.abUrls.some((r) => r.url.trim()) ? (p.rotatorMode === "none" ? "ab" : p.rotatorMode) : "none",
    deepLink: p.deepLink, deepLinkConfig: p.deepLink ? { ...p.deepLinkConfig } : {},
    cloaking: p.cloaking, botBlock: p.botBlock, inAppBreakout: p.inAppBreakout, isPublic: p.isPublic, notes: nz(p.notes),
    tags: p.tags, activateAt: nz(p.activateAt), blockCountries: p.blockCountries.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    blockIps: p.blockIps.split(/[\n,;\s]+/).map((v) => v.trim()).filter(Boolean).slice(0, 200), fallbackUrl: nz(p.fallbackUrl),
    alertThreshold: p.alertThreshold && p.alertThreshold > 0 ? Math.floor(p.alertThreshold) : null,
  };
}

/** Plan gates for the premium fields (createLink enforces them on create; this covers updates). */
function assertPremiumFields(features: PlanFeatures, isAdmin: boolean, input: Partial<LinkInput>) {
  if (isAdmin) return;
  if (input.activateAt && !features.expiration) throw new LinkError("Scheduled activation is not available on your plan. Please upgrade.", 402);
  if ((input.blockCountries?.length || input.blockIps?.length) && !features.conditions) throw new LinkError("Blocklists are not available on your plan. Please upgrade.", 402);
}

async function actor(ws: { userId: string; ownerId: string; isAdmin: boolean }) {
  return { userId: ws.ownerId, actorId: ws.userId, isAdmin: ws.isAdmin, ip: clientIp(await headers()) };
}

function validateTargets(input: LinkInput) {
  const all = [...(input.geoTargets ?? []), ...(input.deviceTargets ?? []), ...(input.langTargets ?? []), ...(input.timeTargets ?? []), ...(input.conditions ?? []), ...(input.abUrls ?? [])] as { url: string }[];
  for (const t of all) if (!isValidUrl(t.url)) throw new LinkError(`Invalid targeting URL: ${t.url}`);
  for (const u of [input.expiredUrl, input.clickLimitUrl, input.fallbackUrl]) if (u && !isValidUrl(normalizeUrl(u))) throw new LinkError(`Invalid URL: ${u}`);
  for (const ip of input.blockIps ?? []) if (!/^[0-9a-fA-F.:*/]{2,45}$/.test(ip)) throw new LinkError(`Invalid IP pattern: ${ip}`);
}

async function ownedLink(id: string, ownerId: string) {
  const link = await db.link.findFirst({ where: { id, userId: ownerId } });
  if (!link) throw new LinkError("Link not found", 404);
  return link;
}

function fail(e: unknown): ActionState {
  return { error: e instanceof Error ? e.message : "Something went wrong" };
}

async function ensureRefs(ownerId: string, input: LinkInput, channelId: string | null) {
  if (input.campaignId && !(await db.campaign.findFirst({ where: { id: input.campaignId, userId: ownerId } }))) throw new LinkError("Invalid campaign");
  if (channelId && !(await db.channel.findFirst({ where: { id: channelId, userId: ownerId } }))) throw new LinkError("Invalid channel");
  if (input.splashId && !(await db.splashPage.findFirst({ where: { id: input.splashId, userId: ownerId } }))) throw new LinkError("Invalid splash page");
  if (input.overlayId && !(await db.overlay.findFirst({ where: { id: input.overlayId, userId: ownerId } }))) throw new LinkError("Invalid overlay");
  if (input.pixelIds?.length) {
    const count = await db.pixel.count({ where: { id: { in: input.pixelIds }, userId: ownerId } });
    if (count !== input.pixelIds.length) throw new LinkError("Invalid pixel selection");
  }
}

/** Create or update a link from the full editor. */
export async function saveLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const id = String(fd.get("id") ?? "");
  const parsed = linkPayloadSchema.safeParse(JSON.parse(String(fd.get("payload") ?? "{}")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid form data" };
  const p = parsed.data;
  try {
    if (!can(ws, "links", id ? "edit" : "create")) throw new LinkError("You do not have permission to do that", 403);
    const { user, features } = await getUserPlan(ws.ownerId);
    const isAdmin = user.role === "admin";
    const input = clean(p);
    validateTargets(input);
    await ensureRefs(ws.ownerId, input, p.channelId);
    if (id) {
      const existing = await ownedLink(id, ws.ownerId);
      const patch: Partial<LinkInput> = { ...input };
      if (p.password) patch.password = p.password; else if (p.clearPassword) patch.password = null; else delete patch.password;
      if (!input.alias || input.alias === existing.alias) delete patch.alias;
      delete patch.domainId; // domain cannot be changed after creation (alias uniqueness is per domain)
      assertLinkFeatures(features, isAdmin, { ...patch, alias: patch.alias, password: p.password || null });
      assertPremiumFields(features, isAdmin, patch);
      const updated = await updateLink(id, ws.ownerId, patch, isAdmin);
      await db.link.update({ where: { id }, data: { channelId: p.channelId || null } });
      await logActivity({ ...(await actor(ws)), action: "link.update", target: "link", targetId: id, meta: { alias: updated.alias, url: updated.url } });
      revalidatePath("/dashboard/links"); revalidatePath(`/dashboard/links/${id}`);
      return { ok: true, message: "Link updated", data: { id: updated.id, short: shortUrl(updated) } };
    }
    if (p.password) input.password = p.password;
    input.teamId = ws.teamId;
    const link = await createLink(ws.ownerId, input, { ip: clientIp(await headers()), countryCode: parseVisitor(await headers()).countryCode });
    if (p.channelId) await db.link.update({ where: { id: link.id }, data: { channelId: p.channelId } });
    await logActivity({ ...(await actor(ws)), action: "link.create", target: "link", targetId: link.id, meta: { alias: link.alias, url: link.url, short: shortUrl(link) } });
    revalidatePath("/dashboard/links"); revalidatePath("/dashboard");
    return { ok: true, message: "Link created", data: { id: link.id, short: shortUrl(link), alias: link.alias, status: link.status } };
  } catch (e) { return fail(e); }
}

/** Overview quick shorten form. */
export async function quickShorten(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "create")) return { error: "You do not have permission to create links" };
  try {
    const link = await createLink(ws.ownerId, { url: String(fd.get("url") ?? ""), alias: String(fd.get("alias") ?? "") || null, domainId: String(fd.get("domainId") ?? "") || null, teamId: ws.teamId }, { ip: clientIp(await headers()), countryCode: parseVisitor(await headers()).countryCode });
    await logActivity({ ...(await actor(ws)), action: "link.create", target: "link", targetId: link.id, meta: { alias: link.alias, url: link.url, quick: true } });
    revalidatePath("/dashboard"); revalidatePath("/dashboard/links");
    return { ok: true, message: link.status === "pending" ? "Link created and awaiting approval" : "Link created", data: { id: link.id, short: shortUrl(link) } };
  } catch (e) { return fail(e); }
}

export async function deleteLink(id: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "delete")) return { error: "No permission" };
  try {
    const link = await ownedLink(id, ws.ownerId);
    await db.link.delete({ where: { id } });
    dispatchWebhooks(ws.ownerId, "link.deleted", { id, alias: link.alias }).catch(() => {});
    await logActivity({ ...(await actor(ws)), action: "link.delete", target: "link", targetId: id, meta: { alias: link.alias, url: link.url } });
    revalidatePath("/dashboard/links");
    return { ok: true, message: "Link deleted" };
  } catch (e) { return fail(e); }
}

export async function setArchived(id: string, archived: boolean): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "edit")) return { error: "No permission" };
  try {
    const link = await ownedLink(id, ws.ownerId);
    await db.link.update({ where: { id }, data: { isArchived: archived } });
    await logActivity({ ...(await actor(ws)), action: archived ? "link.archive" : "link.unarchive", target: "link", targetId: id, meta: { alias: link.alias } });
    revalidatePath("/dashboard/links");
    return { ok: true, message: archived ? "Link archived" : "Link restored" };
  } catch (e) { return fail(e); }
}

export async function setPinned(id: string, pinned: boolean): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "edit")) return { error: "No permission" };
  try {
    await ownedLink(id, ws.ownerId);
    await db.link.update({ where: { id }, data: { isPinned: pinned } });
    revalidatePath("/dashboard/links");
    return { ok: true, message: pinned ? "Link pinned" : "Link unpinned" };
  } catch (e) { return fail(e); }
}

/** Copies a link (settings, targeting, pixels) under a fresh random alias. */
export async function duplicateLink(id: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "create")) return { error: "No permission" };
  try {
    const src = await db.link.findFirst({ where: { id, userId: ws.ownerId }, include: { pixels: true } });
    if (!src) throw new LinkError("Link not found", 404);
    const total = await withinLimit(ws.ownerId, "limitLinks");
    if (!total.ok) throw new LinkError(`You have reached your plan limit of ${total.limit} links.`, 402);
    const alias = await generateAlias(src.domainId);
    const copy = await db.link.create({ data: {
      alias, url: src.url, domainId: src.domainId, userId: ws.ownerId, teamId: ws.teamId, campaignId: src.campaignId, channelId: src.channelId,
      title: src.title ? `${src.title} (copy)` : null, description: src.description, image: src.image, redirectType: src.redirectType, splashId: src.splashId, overlayId: src.overlayId,
      password: src.password, expiresAt: src.expiresAt, expiredUrl: src.expiredUrl, clickLimit: src.clickLimit, clickLimitUrl: src.clickLimitUrl,
      geoTargets: src.geoTargets, deviceTargets: src.deviceTargets, langTargets: src.langTargets, timeTargets: src.timeTargets, conditions: src.conditions, abUrls: src.abUrls, rotatorMode: src.rotatorMode,
      deepLink: src.deepLink, deepLinkConfig: src.deepLinkConfig, utm: src.utm, customParams: src.customParams, forwardParams: src.forwardParams, cloaking: src.cloaking, botBlock: src.botBlock, inAppBreakout: src.inAppBreakout,
      isPublic: src.isPublic, notes: src.notes, status: src.status === "pending" ? "pending" : "active",
      tags: src.tags, blockCountries: src.blockCountries, blockIps: src.blockIps, fallbackUrl: src.fallbackUrl, alertThreshold: src.alertThreshold,
      pixels: src.pixels.length ? { create: src.pixels.map((p) => ({ pixelId: p.pixelId })) } : undefined,
    } });
    await logActivity({ ...(await actor(ws)), action: "link.duplicate", target: "link", targetId: copy.id, meta: { from: src.id, alias: copy.alias } });
    revalidatePath("/dashboard/links");
    return { ok: true, message: "Link duplicated", data: { id: copy.id } };
  } catch (e) { return fail(e); }
}

export type BulkAction = "channel" | "campaign" | "pixels" | "archive" | "unarchive" | "delete" | "addTag" | "removeTag";

/** Bulk operations on a selection of links. */
export async function bulkLinks(action: BulkAction, ids: string[], value = ""): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!ids.length) return { error: "Select at least one link" };
  if (!can(ws, "links", action === "delete" ? "delete" : "edit")) return { error: "No permission" };
  try {
    const owned = await db.link.findMany({ where: { id: { in: ids }, userId: ws.ownerId }, select: { id: true } });
    const list = owned.map((l) => l.id);
    if (!list.length) throw new LinkError("No links found");
    switch (action) {
      case "delete": await db.link.deleteMany({ where: { id: { in: list } } }); break;
      case "archive": await db.link.updateMany({ where: { id: { in: list } }, data: { isArchived: true } }); break;
      case "unarchive": await db.link.updateMany({ where: { id: { in: list } }, data: { isArchived: false } }); break;
      case "channel":
        if (value && !(await db.channel.findFirst({ where: { id: value, userId: ws.ownerId } }))) throw new LinkError("Invalid channel");
        await db.link.updateMany({ where: { id: { in: list } }, data: { channelId: value || null } }); break;
      case "campaign":
        if (value && !(await db.campaign.findFirst({ where: { id: value, userId: ws.ownerId } }))) throw new LinkError("Invalid campaign");
        await db.link.updateMany({ where: { id: { in: list } }, data: { campaignId: value || null } }); break;
      case "pixels": {
        const { user, features } = await getUserPlan(ws.ownerId);
        if (user.role !== "admin" && !features.pixels) throw new LinkError("Pixels are not available on your plan", 402);
        const pixelIds = value.split(",").map((v) => v.trim()).filter(Boolean);
        const count = pixelIds.length ? await db.pixel.count({ where: { id: { in: pixelIds }, userId: ws.ownerId } }) : 0;
        if (count !== pixelIds.length) throw new LinkError("Invalid pixel selection");
        await db.$transaction([
          db.linkPixel.deleteMany({ where: { linkId: { in: list } } }),
          ...(pixelIds.length ? [db.linkPixel.createMany({ data: list.flatMap((linkId) => pixelIds.map((pixelId) => ({ linkId, pixelId }))) })] : []),
        ]);
        break;
      }
      case "addTag":
      case "removeTag": {
        const tag = value.trim().replace(/\s+/g, " ").slice(0, 40);
        if (!tag) throw new LinkError("Please enter a tag");
        const rows = await db.link.findMany({ where: { id: { in: list } }, select: { id: true, tags: true } });
        await db.$transaction(rows.map((r) => {
          const current = r.tags.split(",").map((t) => t.trim()).filter(Boolean);
          const next = action === "addTag"
            ? (current.some((t) => t.toLowerCase() === tag.toLowerCase()) ? current : [...current, tag].slice(0, 20))
            : current.filter((t) => t.toLowerCase() !== tag.toLowerCase());
          return db.link.update({ where: { id: r.id }, data: { tags: next.join(",") } });
        }));
        break;
      }
    }
    await logActivity({ ...(await actor(ws)), action: action === "delete" ? "link.delete" : "link.bulk", target: "link", meta: { action, count: list.length, value: value.slice(0, 100), ids: list.slice(0, 50) } });
    revalidatePath("/dashboard/links");
    return { ok: true, message: `${list.length} link${list.length === 1 ? "" : "s"} updated` };
  } catch (e) { return fail(e); }
}

/** Live alias availability used by the editor. */
export async function checkAlias(alias: string, domainId: string | null, excludeId?: string): Promise<{ available: boolean }> {
  const ws = await getWorkspace();
  if (!ws || !alias) return { available: false };
  return { available: await isAliasAvailable(alias.trim(), domainId || null, excludeId) };
}

/** AI Copilot: propose a memorable slug for a destination. */
export async function suggestSlug(url: string, title: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  try {
    const text = await aiComplete(ws.userId, "slug", `Suggest 5 short, memorable, lowercase URL slugs (letters, numbers, dashes only, max 20 chars) for this link. Return only the slugs separated by commas.\nURL: ${url}\nTitle: ${title || "(none)"}`);
    const slugs = text.split(/[,\n]/).map((s) => s.trim().replace(/[^a-zA-Z0-9_-]/g, "")).filter((s) => s.length > 1 && s.length <= 30).slice(0, 5);
    if (!slugs.length) throw new Error("No suggestions returned");
    return { ok: true, data: slugs };
  } catch (e) { return fail(e); }
}

/** AI Copilot: narrative insights for a link's statistics. */
export async function aiInsights(linkId: string, days: number): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  try {
    const link = await ownedLink(linkId, ws.ownerId);
    const st = await getStats({ linkId }, days);
    const top = (rows: { label: string; count: number }[]) => rows.slice(0, 5).map((r) => `${r.label} (${r.count})`).join(", ") || "none";
    const summary = `Short link: ${link.alias} -> ${link.url}\nPeriod: last ${days} days\nTotal clicks: ${st.total}, unique: ${st.unique}\nClicks per day: ${st.byDay.map((d) => d.clicks).join(",")}\nPeak hours (UTC): ${st.byHour.filter((h) => h.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 3).map((h) => `${h.hour}h (${h.clicks})`).join(", ") || "none"}\nCountries: ${top(st.countries)}\nReferrers: ${top(st.referers)}\nDevices: ${top(st.devices)}\nBrowsers: ${top(st.browsers)}\nOS: ${top(st.os)}\nLanguages: ${top(st.languages)}\nUTM sources: ${top(st.utmSources)}`;
    const text = await aiComplete(ws.userId, "insights", `Analyze these short link statistics and write 4-6 concise, actionable insights for a marketer (bullet points, plain text, no markdown headers).\n\n${summary}`);
    return { ok: true, data: text };
  } catch (e) { return fail(e); }
}
