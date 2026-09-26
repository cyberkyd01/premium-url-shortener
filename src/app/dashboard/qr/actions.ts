"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { createLink, shortUrl, LinkError } from "@/lib/links";
import { generateFreeAlias } from "@/lib/alias";
import { appUrl, isValidUrl, normalizeUrl } from "@/lib/utils";
import { bioUrl } from "@/lib/bio-widgets";
import { QR_TYPES, QR_TYPE_FIELDS, encodeQrData, normalizeQrStyle, isDynamicCapable, DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr-types";

export interface QrInput { name: string; type: string; data: Record<string, string>; isDynamic: boolean; linkId: string | null; bioPageId: string | null; channelId: string | null; style: Partial<QrStyle> }
export type QrSaveResult = { ok: boolean; id?: string; error?: string };

async function ws(action: "view" | "create" | "edit" | "delete") {
  const w = await getWorkspace();
  if (!w) throw new Error("UNAUTHENTICATED");
  if (!can(w, "qr", action)) throw new Error("You do not have permission to " + action + " QR codes");
  return w;
}

/** Strips style options the plan does not allow (advanced styles, frames, logos). */
function restrictStyle(style: Partial<QrStyle>, advanced: boolean, defaultLogo: string): string {
  const s = normalizeQrStyle(style);
  if (!advanced) {
    s.dots = "square"; s.corners = "square"; s.cornerDots = "square"; s.gradient = null; s.frame = "none";
    s.logo = s.logo && defaultLogo && s.logo === defaultLogo ? defaultLogo : null;
  }
  return JSON.stringify(s);
}

async function prepare(input: QrInput, ownerId: string, teamId: string | null, existingId?: string) {
  const s = await getSettings();
  if (s["qr.enabled"] !== "1") throw new Error("QR codes are disabled");
  const { user, features } = await getUserPlan(ownerId);
  const isAdmin = user.role === "admin";
  const type = QR_TYPES.find((t) => t.type === input.type)?.type;
  if (!type) throw new Error("Invalid QR type");
  if (!isAdmin && !features.qrTypes.includes(type)) throw new Error(`The "${type}" QR type is not available on your plan. Please upgrade.`);
  const name = (input.name ?? "").trim().slice(0, 100) || "QR code";
  const data: Record<string, string> = {};
  for (const f of QR_TYPE_FIELDS[type]) {
    const v = typeof input.data?.[f.key] === "string" ? input.data[f.key].trim().slice(0, 2000) : "";
    if (f.required && !v && !["link", "bio"].includes(type)) throw new Error(`${f.label} is required`);
    if (v) data[f.key] = f.type === "url" ? normalizeUrl(v) : v;
  }
  let linkId: string | null = null, bioPageId: string | null = null;
  if (type === "link") {
    const link = input.linkId ? await db.link.findFirst({ where: { id: input.linkId, userId: ownerId }, include: { domain: true } }) : null;
    if (!link) throw new Error("Please pick one of your short links");
    linkId = link.id; data.url = shortUrl(link);
  }
  if (type === "bio") {
    const page = input.bioPageId ? await db.bioPage.findFirst({ where: { id: input.bioPageId, userId: ownerId }, include: { domain: true } }) : null;
    if (!page) throw new Error("Please pick one of your bio pages");
    bioPageId = page.id; data.url = bioUrl(page, appUrl("/"));
  }
  if (type === "url" && !isValidUrl(data.url ?? "")) throw new Error("Please enter a valid URL");
  if (type === "app") {
    if (!isValidUrl(data.fallback ?? "")) throw new Error("Please enter a valid fallback URL");
    if (!existingId) {
      const targets = [data.ios ? { device: "ios", url: data.ios } : null, data.android ? { device: "android", url: data.android } : null].filter(Boolean);
      let link;
      try { link = await createLink(ownerId, { url: data.fallback, deviceTargets: targets, title: name, teamId }, { skipLimits: true }); }
      catch (e) { if (e instanceof LinkError && /device targeting/i.test(e.message)) link = await createLink(ownerId, { url: data.fallback, title: name, teamId }, { skipLimits: true }); else throw e; }
      linkId = link.id; data.url = shortUrl({ alias: link.alias, domain: null });
    }
  }
  if (input.channelId) { const ch = await db.channel.findFirst({ where: { id: input.channelId, userId: ownerId } }); if (!ch) throw new Error("Invalid channel"); }
  const advanced = (features.advancedQr || isAdmin) && s["qr.advanced"] !== "0";
  const isDynamic = !!input.isDynamic && isDynamicCapable(type) && (features.dynamicQr || isAdmin);
  return { type, name, data, linkId, bioPageId, channelId: input.channelId || null, isDynamic, style: restrictStyle(input.style ?? {}, advanced, s["qr.defaultLogo"]) };
}

/** Creates or updates a QR code, enforcing plan limits, allowed types and advanced style features. */
export async function saveQr(id: string | null, input: QrInput): Promise<QrSaveResult> {
  try {
    const w = await ws(id ? "edit" : "create");
    const existing = id ? await db.qrCode.findFirst({ where: { id, userId: w.ownerId } }) : null;
    if (id && !existing) return { ok: false, error: "QR code not found" };
    const p = await prepare(input, w.ownerId, w.teamId, existing?.id);
    if (existing) {
      // keep the tracking alias and app link; a static code can become dynamic and vice-versa
      const alias = p.isDynamic ? existing.alias ?? (await generateFreeAlias()) : null;
      const linkId = existing.type === "app" && p.type === "app" ? existing.linkId : p.linkId;
      const data = existing.type === "app" && p.type === "app" ? { ...p.data, url: existing.data ? (JSON.parse(existing.data) as Record<string, string>).url ?? p.data.url : p.data.url } : p.data;
      await db.qrCode.update({ where: { id: existing.id }, data: { name: p.name, type: p.type, data: JSON.stringify(data), isDynamic: p.isDynamic, alias, linkId, bioPageId: p.bioPageId, channelId: p.channelId, style: p.style } });
      revalidatePath("/dashboard/qr");
      return { ok: true, id: existing.id };
    }
    const total = await withinLimit(w.ownerId, "limitQrCodes");
    if (!total.ok) return { ok: false, error: `You reached the limit of ${total.limit} QR codes on your plan. Please upgrade.` };
    const monthly = await withinLimit(w.ownerId, "limitQrMonthly");
    if (!monthly.ok) return { ok: false, error: `You reached your monthly limit of ${monthly.limit} QR codes.` };
    const created = await db.qrCode.create({ data: { userId: w.ownerId, teamId: w.teamId, name: p.name, type: p.type, data: JSON.stringify(p.data), isDynamic: p.isDynamic, alias: p.isDynamic ? await generateFreeAlias() : null, linkId: p.linkId, bioPageId: p.bioPageId, channelId: p.channelId, style: p.style } });
    revalidatePath("/dashboard/qr");
    return { ok: true, id: created.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save QR code" };
  }
}

export async function deleteQr(fd: FormData) {
  const w = await ws("delete");
  const id = String(fd.get("id") ?? "");
  await db.qrCode.deleteMany({ where: { id, userId: w.ownerId } });
  revalidatePath("/dashboard/qr");
}

export async function bulkDeleteQr(ids: string[]): Promise<QrSaveResult> {
  try {
    const w = await ws("delete");
    await db.qrCode.deleteMany({ where: { id: { in: ids.filter((x) => typeof x === "string") }, userId: w.ownerId } });
    revalidatePath("/dashboard/qr");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Failed" }; }
}

export async function bulkAssignChannel(ids: string[], channelId: string | null): Promise<QrSaveResult> {
  try {
    const w = await ws("edit");
    if (channelId) { const ch = await db.channel.findFirst({ where: { id: channelId, userId: w.ownerId } }); if (!ch) return { ok: false, error: "Invalid channel" }; }
    await db.qrCode.updateMany({ where: { id: { in: ids.filter((x) => typeof x === "string") }, userId: w.ownerId }, data: { channelId } });
    revalidatePath("/dashboard/qr");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Failed" }; }
}

export type BulkQrResult = { ok: boolean; error?: string; created: { id: string; name: string }[]; errors: string[] };

/** Bulk generator: each line is `url` or `name,url` (CSV). Requires features.bulkQr. */
export async function bulkCreateQr(text: string, style: Partial<QrStyle>, dynamic: boolean): Promise<BulkQrResult> {
  const out: BulkQrResult = { ok: false, created: [], errors: [] };
  try {
    const w = await ws("create");
    const { user, features } = await getUserPlan(w.ownerId);
    const isAdmin = user.role === "admin";
    if (!features.bulkQr && !isAdmin) return { ...out, error: "Bulk QR generation is not available on your plan. Please upgrade." };
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
    if (!lines.length) return { ...out, error: "Paste at least one URL" };
    for (const [i, line] of lines.entries()) {
      const parts = line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      const urlPart = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const name = parts.length > 1 ? parts.slice(0, -1).join(",") : `QR ${i + 1}`;
      if (i === 0 && /^name\s*$/i.test(parts[0] ?? "") && /^url\s*$/i.test(urlPart)) continue; // header row
      const res = await saveQr(null, { name, type: "url", data: { url: urlPart }, isDynamic: dynamic, linkId: null, bioPageId: null, channelId: null, style: { ...DEFAULT_QR_STYLE, ...style } });
      if (res.ok && res.id) out.created.push({ id: res.id, name });
      else { out.errors.push(`Line ${i + 1}: ${res.error}`); if (/limit/i.test(res.error ?? "")) break; }
    }
    out.ok = out.created.length > 0;
    if (!out.ok && !out.error) out.error = out.errors[0] ?? "Nothing was created";
    revalidatePath("/dashboard/qr");
    return out;
  } catch (e) { return { ...out, error: e instanceof Error ? e.message : "Failed" }; }
}

/** Preview helper for the client: the encoded payload string for a set of fields. */
export async function previewQrData(type: string, data: Record<string, string>): Promise<string> {
  return encodeQrData(type, data);
}
