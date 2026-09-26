"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aiComplete } from "@/lib/ai";
import { getStats } from "@/lib/stats";
import { withinLimit } from "@/lib/plan";
import { isAliasAvailable } from "@/lib/links";
import { isValidUrl, normalizeUrl, randomAlias, slugify } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/ai";
const BLOCK_TYPES = new Set(["link", "heading", "text", "email", "phone", "youtube", "instagram", "twitter", "tiktok", "facebook", "linkedin", "github", "whatsapp", "telegram", "spotify", "divider"]);

function err(e: unknown) { return e instanceof Error ? e.message : "AI request failed"; }

/** Extracts the first JSON object/array from an LLM answer. */
function parseJson<T>(text: string): T | null {
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

export async function generateSlugs(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const url = normalizeUrl(String(fd.get("url") ?? ""));
  const keywords = String(fd.get("keywords") ?? "").trim().slice(0, 200);
  if (!isValidUrl(url)) return { error: "Enter a valid URL" };
  try {
    const text = await aiComplete(u.id, "slug", `Suggest 5 short, memorable, lowercase URL slugs (3-14 characters, letters, numbers and dashes only) for a short link pointing to: ${url}${keywords ? `\nKeywords: ${keywords}` : ""}\nReturn ONLY a JSON array of 5 strings.`);
    const arr = parseJson<unknown[]>(text) ?? text.split(/\n/).map((l) => l.replace(/^[\s\d.\-*]+/, ""));
    const slugs = Array.from(new Set(arr.map((s) => slugify(String(s)).slice(0, 20)).filter((s) => s.length >= 2))).slice(0, 5);
    if (!slugs.length) return { error: "No suggestions returned. Try again." };
    const withAvailability = await Promise.all(slugs.map(async (s) => ({ slug: s, available: await isAliasAvailable(s, null) })));
    revalidatePath(P);
    return { ok: true, data: { url, slugs: withAvailability } };
  } catch (e) { return { error: err(e) }; }
}

export interface AiBio { name: string; bio: string; blocks: { type: string; title: string; url?: string }[] }

export async function generateBio(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const description = String(fd.get("description") ?? "").trim().slice(0, 1500);
  if (description.length < 10) return { error: "Describe yourself or your brand in a few sentences" };
  try {
    const text = await aiComplete(u.id, "bio", `Create a link-in-bio page from this description:\n"""${description}"""\nReturn ONLY JSON: {"name": string, "bio": string (max 160 chars), "blocks": [{"type": one of ${[...BLOCK_TYPES].join("|")}, "title": string, "url": string (https URL, or mailto:/tel: for email/phone; omit for heading/text/divider)}]} with 5 to 8 blocks, starting with a heading.`);
    const data = parseJson<AiBio>(text);
    if (!data || !Array.isArray(data.blocks)) return { error: "The AI returned an unexpected format. Try again." };
    const blocks = data.blocks.filter((b) => b && typeof b.type === "string" && BLOCK_TYPES.has(b.type)).map((b) => ({ type: b.type, title: String(b.title ?? "").slice(0, 120), url: b.url && (isValidUrl(String(b.url)) ? String(b.url) : undefined) })).slice(0, 12);
    revalidatePath(P);
    return { ok: true, data: { name: String(data.name ?? "").slice(0, 80), bio: String(data.bio ?? "").slice(0, 300), blocks } satisfies AiBio };
  } catch (e) { return { error: err(e) }; }
}

export async function createBioFromAi(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  let data: AiBio;
  try { data = JSON.parse(String(fd.get("payload") ?? "")) as AiBio; } catch { return { error: "Invalid payload" }; }
  const lim = await withinLimit(u.id, "limitBioPages");
  if (!lim.ok) return { error: `You have reached your plan limit of ${lim.limit} bio pages` };
  let alias = slugify(data.name || "").slice(0, 20) || randomAlias(6);
  while (!(await isAliasAvailable(alias, null))) alias = `${slugify(data.name || "bio").slice(0, 14) || "bio"}-${randomAlias(4).toLowerCase()}`;
  const page = await db.bioPage.create({ data: { alias, userId: u.id, name: data.name?.slice(0, 80) || null, bio: data.bio?.slice(0, 300) || null, blocks: { create: (data.blocks ?? []).filter((b) => BLOCK_TYPES.has(b.type)).slice(0, 12).map((b, i) => ({ type: b.type, title: b.title?.slice(0, 120) || null, url: b.url && isValidUrl(b.url) ? b.url : null, order: i, content: "{}" })) } } });
  revalidatePath("/dashboard/bio");
  return { ok: true, message: "Bio page created", data: { id: page.id, alias } };
}

export async function clickInsights(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const linkId = String(fd.get("linkId") ?? "");
  const link = await db.link.findFirst({ where: { id: linkId, userId: u.id }, include: { domain: true } });
  if (!link) return { error: "Link not found" };
  const st = await getStats({ linkId: link.id }, 30);
  const top = (arr: { label: string; count: number }[], n = 5) => arr.slice(0, n).map((x) => `${x.label} (${x.count})`).join(", ") || "none";
  const bestDay = st.byDay.reduce((a, b) => (b.clicks > a.clicks ? b : a), st.byDay[0] ?? { date: "-", clicks: 0 });
  const bestHour = st.byHour.reduce((a, b) => (b.clicks > a.clicks ? b : a), st.byHour[0] ?? { hour: 0, clicks: 0 });
  const summary = `Short link ${link.alias} → ${link.url}\nLast 30 days: ${st.total} clicks, ${st.unique} unique.\nBest day: ${bestDay.date} (${bestDay.clicks}). Peak hour: ${bestHour.hour}:00.\nCountries: ${top(st.countries)}\nReferrers: ${top(st.referers)}\nDevices: ${top(st.devices)}\nBrowsers: ${top(st.browsers)}\nOS: ${top(st.os)}\nDaily clicks: ${st.byDay.map((d) => d.clicks).join(",")}`;
  try {
    const text = await aiComplete(u.id, "insights", `You are an analytics assistant. Analyse these short link statistics and write a concise report (max 180 words) with: a headline summary, 3 notable trends or anomalies, and 3 actionable recommendations to increase clicks. Use plain text with short bullet points.\n\n${summary}`);
    revalidatePath(P);
    return { ok: true, data: { text, total: st.total, unique: st.unique, alias: link.alias } };
  } catch (e) { return { error: err(e) }; }
}
