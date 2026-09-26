"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { isValidAlias } from "@/lib/utils";
import { globalAliasAvailable, generateFreeAlias } from "@/lib/alias";
import { BIO_TEMPLATES, BIO_THEMES, BIO_FONTS, BIO_LAYOUTS, BIO_BUTTON_STYLES, SOCIAL_ICON_STYLES, SOCIAL_NETWORKS, WIDGETS, BLOCK_ANIMATIONS, type BioColors, type BioSeo, type BioSocial } from "@/lib/bio-widgets";
import type { ActionState } from "@/components/ui/form-state";

export interface BioPageInput {
  name: string; bio: string; avatar: string; cover: string; alias: string; domainId: string | null; channelId: string | null;
  theme: string; layout: string; buttonStyle: string; font: string; colors: BioColors; customCss: string; customJs: string; customLogo: string; hideBranding: boolean;
  seo: BioSeo; socials: BioSocial[]; socialsPosition: string; socialIconStyle: string;
  password: string; ageGate: number | null; sensitive: boolean; newsletterGate: boolean; nsfwWarning: boolean; pixelIds: string[]; contactEmail: string; status: string; listed?: boolean;
}
export interface BioBlockInput {
  id?: string | null; clientId: string; type: string; title: string; url: string; thumbnail: string; content: Record<string, unknown>; order: number; enabled: boolean;
  scheduleStart: string | null; scheduleEnd: string | null; countries: string[]; languages: string[]; sensitive: boolean; gated: string | null; animation: string | null;
}
export type SaveBioResult = { ok: boolean; id?: string; error?: string; blockIds?: Record<string, string>; savedAt?: string };

async function ws(action: "view" | "create" | "edit" | "delete") {
  const w = await getWorkspace();
  if (!w) throw new Error("UNAUTHENTICATED");
  if (!can(w, "bio", action)) throw new Error("You do not have permission to " + action + " bio pages");
  return w;
}

const oneOf = (v: string, list: string[], fallback: string) => (list.includes(v) ? v : fallback);
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");
const HEX = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|linear-gradient\([^;{}]*\)|radial-gradient\([^;{}]*\)|conic-gradient\([^;{}]*\))$/;

/** Validates and normalizes the page input against the workspace plan. Throws Error with a user message. */
async function normalizePage(input: BioPageInput, ownerId: string, excludeId?: string) {
  const { user, features } = await getUserPlan(ownerId);
  const isAdmin = user.role === "admin";
  const s = await getSettings();
  const alias = str(input.alias, 64).trim();
  if (!isValidAlias(alias)) throw new Error("Alias may only contain letters, numbers, - and _");
  let domainId: string | null = null;
  if (input.domainId) {
    if (!features.bioCustomDomain && !isAdmin) throw new Error("Custom domains for bio pages are not available on your plan");
    const d = await db.domain.findFirst({ where: { id: input.domainId, status: 1, OR: [{ userId: ownerId }, { isPublic: true }] } });
    if (!d) throw new Error("Invalid domain");
    domainId = d.id;
  } else if (s["misc.mainDomainForBio"] === "0" && !isAdmin) {
    throw new Error("Please select a custom domain");
  }
  if (!(await globalAliasAvailable(alias, domainId, { bioId: excludeId }))) throw new Error("This alias is already taken");
  if (input.channelId) {
    const ch = await db.channel.findFirst({ where: { id: input.channelId, userId: ownerId } });
    if (!ch) throw new Error("Invalid channel");
  }
  const colors: BioColors = {};
  for (const k of ["bg", "bgGradient", "text", "button", "buttonText", "link"] as const) { const v = str(input.colors?.[k], 300).trim(); if (v && HEX.test(v)) colors[k] = v; }
  if (input.colors?.animation === "gradient" || input.colors?.animation === "particles") colors.animation = input.colors.animation;
  const pixelIds: string[] = [];
  if (Array.isArray(input.pixelIds) && input.pixelIds.length && (features.pixels || isAdmin)) {
    const rows = await db.pixel.findMany({ where: { id: { in: input.pixelIds.filter((x): x is string => typeof x === "string") }, userId: ownerId }, select: { id: true } });
    pixelIds.push(...rows.map((r) => r.id));
  }
  const socials: BioSocial[] = (Array.isArray(input.socials) ? input.socials : [])
    .filter((x) => x && typeof x.url === "string" && x.url.trim() && SOCIAL_NETWORKS.some((n) => n.key === x.network))
    .map((x, i) => ({ network: x.network, url: str(x.url, 500).trim(), order: i }));
  const seo: BioSeo = { title: str(input.seo?.title, 120), description: str(input.seo?.description, 300), image: str(input.seo?.image, 500), noindex: !!input.seo?.noindex };
  const age = input.ageGate ? Math.min(99, Math.max(1, Math.round(Number(input.ageGate)))) : null;
  const data: Prisma.BioPageUncheckedCreateInput = {
    userId: ownerId, alias, domainId, channelId: input.channelId || null,
    name: str(input.name, 100).trim() || null, bio: str(input.bio, 1000).trim() || null, avatar: str(input.avatar) || null, cover: str(input.cover) || null,
    theme: oneOf(input.theme, BIO_THEMES.map((t) => t.key), "default"), layout: oneOf(input.layout, BIO_LAYOUTS.map((l) => l.key), "centered"),
    buttonStyle: oneOf(input.buttonStyle, BIO_BUTTON_STYLES.map((b) => b.key), "rounded"), font: oneOf(input.font, BIO_FONTS, "Inter"),
    colors: JSON.stringify(colors), customCss: features.customCss || isAdmin ? str(input.customCss, 20000) || null : null, customJs: features.customCss || isAdmin ? str(input.customJs, 20000) || null : null,
    customLogo: features.customLogo || isAdmin ? str(input.customLogo) || null : null, hideBranding: (features.noBranding || isAdmin) && !!input.hideBranding,
    seo: JSON.stringify(seo), socials: JSON.stringify(socials), socialsPosition: input.socialsPosition === "top" ? "top" : "bottom",
    socialIconStyle: oneOf(input.socialIconStyle, SOCIAL_ICON_STYLES.map((x) => x.key), "default"),
    password: str(input.password, 100) || null, ageGate: age, sensitive: !!input.sensitive, newsletterGate: !!input.newsletterGate, nsfwWarning: !!input.nsfwWarning,
    pixelsJson: JSON.stringify(pixelIds), contactEmail: str(input.contactEmail, 200).trim() || null, status: input.status === "disabled" ? "disabled" : "active",
    listed: !!input.listed && !input.seo?.noindex,
  };
  return { data, features, isAdmin };
}

function normalizeBlock(b: BioBlockInput, pageId: string, allowHtml: boolean): Prisma.BioBlockUncheckedCreateInput {
  const def = WIDGETS.find((w) => w.type === b.type);
  if (!def) throw new Error("Unknown block type: " + b.type);
  if (def.feature === "customCss" && !allowHtml) throw new Error("Custom HTML blocks are not available on your plan");
  const content: Record<string, unknown> = {};
  if (b.content && typeof b.content === "object") for (const [k, v] of Object.entries(b.content)) if (k.length <= 40) content[k] = v;
  const date = (v: string | null) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
  return {
    bioPageId: pageId, type: b.type, title: str(b.title, 200) || null, url: str(b.url, 2000) || null, thumbnail: str(b.thumbnail, 1000) || null,
    content: JSON.stringify(content).slice(0, 50000), order: Number.isFinite(b.order) ? b.order : 0, enabled: b.enabled !== false,
    scheduleStart: date(b.scheduleStart), scheduleEnd: date(b.scheduleEnd),
    countries: JSON.stringify((Array.isArray(b.countries) ? b.countries : []).filter((c): c is string => typeof c === "string").map((c) => c.toUpperCase().slice(0, 2))),
    languages: JSON.stringify((Array.isArray(b.languages) ? b.languages : []).filter((c): c is string => typeof c === "string").map((c) => c.toLowerCase().slice(0, 5))),
    sensitive: !!b.sensitive, gated: ["newsletter", "password", "age"].includes(b.gated ?? "") ? b.gated : null,
    animation: BLOCK_ANIMATIONS.includes(b.animation ?? "") && b.animation ? b.animation : null,
  };
}

/** Creates or updates a bio page and its blocks (used by the builder autosave). */
export async function saveBio(id: string | null, page: BioPageInput, blocks: BioBlockInput[]): Promise<SaveBioResult> {
  try {
    const w = await ws(id ? "edit" : "create");
    const s = await getSettings();
    if (s["bio.enabled"] !== "1") return { ok: false, error: "Bio pages are disabled" };
    let existing = id ? await db.bioPage.findFirst({ where: { id, userId: w.ownerId } }) : null;
    if (id && !existing) return { ok: false, error: "Page not found" };
    const { data, features, isAdmin } = await normalizePage(page, w.ownerId, existing?.id);
    if (!existing) {
      const lim = await withinLimit(w.ownerId, "limitBioPages");
      if (!lim.ok) return { ok: false, error: `You reached the limit of ${lim.limit} bio pages on your plan. Please upgrade.` };
      const count = await db.bioPage.count({ where: { userId: w.ownerId, isTemplate: false } });
      existing = await db.bioPage.create({ data: { ...data, teamId: w.teamId, isDefault: count === 0 } });
    } else {
      await db.bioPage.update({ where: { id: existing.id }, data });
    }
    const pageId = existing.id;
    const allowHtml = features.customCss || isAdmin;
    const current = await db.bioBlock.findMany({ where: { bioPageId: pageId }, select: { id: true } });
    const keep = new Set<string>();
    const blockIds: Record<string, string> = {};
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [i, b] of blocks.entries()) {
      const norm = normalizeBlock({ ...b, order: i }, pageId, allowHtml);
      if (b.id && current.some((c) => c.id === b.id)) {
        keep.add(b.id);
        blockIds[b.clientId] = b.id;
        ops.push(db.bioBlock.update({ where: { id: b.id }, data: norm }));
      } else {
        const created = await db.bioBlock.create({ data: norm });
        keep.add(created.id);
        blockIds[b.clientId] = created.id;
      }
    }
    const remove = current.filter((c) => !keep.has(c.id)).map((c) => c.id);
    if (remove.length) ops.push(db.bioBlock.deleteMany({ where: { id: { in: remove } } }));
    if (ops.length) await db.$transaction(ops);
    revalidatePath("/dashboard/bio");
    revalidatePath(`/${data.alias}`);
    return { ok: true, id: pageId, blockIds, savedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}

/** Creates a page from a built-in template or a template row, then redirects to the builder. */
export async function createBioFromTemplate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const w = await ws("create");
  const s = await getSettings();
  if (s["bio.enabled"] !== "1") return { error: "Bio pages are disabled" };
  const lim = await withinLimit(w.ownerId, "limitBioPages");
  if (!lim.ok) return { error: `You reached the limit of ${lim.limit} bio pages on your plan. Please upgrade.` };
  const { features, user } = await getUserPlan(w.ownerId);
  const key = String(fd.get("template") ?? "blank");
  const count = await db.bioPage.count({ where: { userId: w.ownerId, isTemplate: false } });
  let pageId = "";
  if (key.startsWith("db:")) {
    if (!features.bioTemplates && user.role !== "admin") return { error: "Templates are not available on your plan" };
    const tpl = await db.bioPage.findFirst({ where: { id: key.slice(3), isTemplate: true }, include: { blocks: true } });
    if (!tpl) return { error: "Template not found" };
    const alias = await generateFreeAlias(tpl.templateName ?? tpl.name ?? "");
    const created = await db.bioPage.create({ data: {
      userId: w.ownerId, teamId: w.teamId, alias, name: tpl.name, bio: tpl.bio, avatar: tpl.avatar, cover: tpl.cover, theme: tpl.theme, layout: tpl.layout, buttonStyle: tpl.buttonStyle, font: tpl.font,
      colors: tpl.colors, customCss: features.customCss ? tpl.customCss : null, customJs: features.customCss ? tpl.customJs : null, seo: tpl.seo, socials: tpl.socials, socialsPosition: tpl.socialsPosition, socialIconStyle: tpl.socialIconStyle, isDefault: count === 0,
      blocks: { create: tpl.blocks.map((b) => ({ type: b.type, title: b.title, url: b.url, content: b.content, thumbnail: b.thumbnail, order: b.order, enabled: b.enabled, animation: b.animation })) },
    } });
    pageId = created.id;
  } else {
    const tpl = BIO_TEMPLATES.find((t) => t.key === key);
    const alias = await generateFreeAlias(tpl?.name ?? "");
    const created = await db.bioPage.create({ data: {
      userId: w.ownerId, teamId: w.teamId, alias, name: user.name || user.username, avatar: user.avatar, isDefault: count === 0,
      ...(tpl ? { theme: tpl.page.theme, layout: tpl.page.layout, buttonStyle: tpl.page.buttonStyle, font: tpl.page.font, socialIconStyle: tpl.page.socialIconStyle, socialsPosition: tpl.page.socialsPosition, bio: tpl.page.bio, colors: tpl.page.colors, socials: JSON.stringify((tpl.socials ?? []).map((x, i) => ({ ...x, order: i }))) } : {}),
      blocks: tpl ? { create: tpl.blocks.map((b, i) => ({ type: b.type, title: b.title ?? null, url: b.url ?? null, thumbnail: b.thumbnail ?? null, content: JSON.stringify(b.content ?? {}), order: i })) } : undefined,
    } });
    pageId = created.id;
  }
  revalidatePath("/dashboard/bio");
  redirect(`/dashboard/bio/${pageId}`);
}

export async function deleteBio(fd: FormData) {
  const w = await ws("delete");
  const id = String(fd.get("id") ?? "");
  const page = await db.bioPage.findFirst({ where: { id, userId: w.ownerId } });
  if (!page) return;
  await db.bioPage.delete({ where: { id } });
  if (page.isDefault) {
    const next = await db.bioPage.findFirst({ where: { userId: w.ownerId, isTemplate: false }, orderBy: { createdAt: "asc" } });
    if (next) await db.bioPage.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  revalidatePath("/dashboard/bio");
}

export async function setDefaultBio(fd: FormData) {
  const w = await ws("edit");
  const id = String(fd.get("id") ?? "");
  const page = await db.bioPage.findFirst({ where: { id, userId: w.ownerId } });
  if (!page) return;
  await db.$transaction([
    db.bioPage.updateMany({ where: { userId: w.ownerId }, data: { isDefault: false } }),
    db.bioPage.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/dashboard/bio");
}

export async function duplicateBio(fd: FormData) {
  const w = await ws("create");
  const id = String(fd.get("id") ?? "");
  const lim = await withinLimit(w.ownerId, "limitBioPages");
  if (!lim.ok) return;
  const page = await db.bioPage.findFirst({ where: { id, userId: w.ownerId }, include: { blocks: true } });
  if (!page) return;
  const alias = await generateFreeAlias(page.alias);
  const { id: _id, createdAt: _c, updatedAt: _u, views: _v, uniqueViews: _uv, isDefault: _d, blocks, ...rest } = page;
  void _id; void _c; void _u; void _v; void _uv; void _d;
  await db.bioPage.create({ data: { ...rest, alias, name: page.name ? page.name + " (copy)" : null, isDefault: false, isTemplate: false,
    blocks: { create: blocks.map(({ id: _b, bioPageId: _p, createdAt: _bc, clicks: _k, ...b }) => { void _b; void _p; void _bc; void _k; return b; }) } } });
  revalidatePath("/dashboard/bio");
}

export async function toggleBioStatus(fd: FormData) {
  const w = await ws("edit");
  const id = String(fd.get("id") ?? "");
  const page = await db.bioPage.findFirst({ where: { id, userId: w.ownerId } });
  if (!page) return;
  await db.bioPage.update({ where: { id }, data: { status: page.status === "active" ? "disabled" : "active" } });
  revalidatePath("/dashboard/bio");
}

/** Admins can promote a page into a reusable template. */
export async function saveAsTemplate(fd: FormData) {
  const w = await ws("edit");
  if (!w.isAdmin) return;
  const id = String(fd.get("id") ?? "");
  const page = await db.bioPage.findFirst({ where: { id, userId: w.ownerId } });
  if (!page) return;
  await db.bioPage.update({ where: { id }, data: { isTemplate: !page.isTemplate, templateName: page.isTemplate ? null : page.name || page.alias } });
  revalidatePath("/dashboard/bio");
}
