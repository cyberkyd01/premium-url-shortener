import type { Link } from "@prisma/client";
import { db } from "./db";
import { notify } from "./notify";
import { sendMail } from "./mail";
import { getSettings } from "./settings";
import { appUrl, escapeHtml } from "./utils";

export const HEALTH_UA = "PremiumURLShortener-HealthBot/1.0 (+link health monitor)";
const TIMEOUT_MS = 8000;

export interface HealthResult { ok: boolean; status: number | null; latencyMs: number; error: string | null; finalUrl: string | null }

type CheckableLink = Pick<Link, "id" | "url" | "alias" | "userId" | "healthStatus" | "fallbackUrl" | "title">;

async function request(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, redirect: "follow", signal: controller.signal, headers: { "user-agent": HEALTH_UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" }, cache: "no-store" });
    // Drain the body on GET so the socket is released.
    if (method === "GET") { try { await res.body?.cancel(); } catch { /* ignore */ } }
    return res;
  } finally { clearTimeout(timer); }
}

/** Performs a HEAD request (falling back to GET when HEAD is rejected) with an 8s timeout. Only http(s) URLs are checked. */
export async function probeUrl(url: string): Promise<HealthResult> {
  const started = Date.now();
  if (!/^https?:\/\//i.test(url)) return { ok: true, status: null, latencyMs: 0, error: null, finalUrl: null };
  try {
    let res = await request(url, "HEAD");
    if (res.status === 405 || res.status === 501 || res.status === 403 || res.status === 404 || res.status >= 500) res = await request(url, "GET");
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status, latencyMs: Date.now() - started, error: ok ? null : `HTTP ${res.status}`, finalUrl: res.url || null };
  } catch (e) {
    const cause = e instanceof Error && typeof e.cause === "object" && e.cause && "code" in e.cause ? String((e.cause as { code?: unknown }).code ?? "") : "";
    const msg = e instanceof Error ? (e.name === "AbortError" ? "Timed out after 8s" : cause ? `${e.message} (${cause})` : e.message) : "Request failed";
    return { ok: false, status: null, latencyMs: Date.now() - started, error: msg.slice(0, 250), finalUrl: null };
  }
}

async function notifyBroken(link: CheckableLink, result: HealthResult) {
  if (!link.userId) return;
  const user = await db.user.findUnique({ where: { id: link.userId }, select: { email: true, notifyEmail: true, username: true } });
  if (!user) return;
  const s = await getSettings();
  const reason = result.status ? `HTTP ${result.status}` : result.error ?? "unreachable";
  const dashboard = appUrl(`/dashboard/links/${link.id}/edit`);
  await notify(link.userId, `Broken link: /${link.alias}`, `The destination of /${link.alias} returned ${reason}. ${link.fallbackUrl ? "Visitors are being sent to your fallback URL." : "Set a fallback URL to keep visitors on track."}`, { type: "warning", link: `/dashboard/health` });
  if (user.notifyEmail) {
    const html = `<p>Hi ${escapeHtml(user.username)},</p>
<p>Our health monitor could not reach the destination of your short link <b>/${escapeHtml(link.alias)}</b>${link.title ? ` (${escapeHtml(link.title)})` : ""}.</p>
<p><b>Destination:</b> ${escapeHtml(link.url)}<br/><b>Result:</b> ${escapeHtml(reason)}</p>
<p>${link.fallbackUrl ? `Visitors are currently redirected to your fallback URL: ${escapeHtml(link.fallbackUrl)}` : "Tip: add a fallback URL so visitors land somewhere useful while the destination is down."}</p>
<p><a href="${dashboard}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Fix the link</a></p>
<p style="color:#71717a;font-size:12px">${escapeHtml(s["site.name"])} · <a href="${appUrl("/dashboard/health")}">Link health dashboard</a></p>`;
    await sendMail({ to: user.email, subject: `[${s["site.name"]}] Broken link detected: /${link.alias}`, html });
  }
}

/** Checks one link, records a LinkCheck row and updates the link's health fields. Notifies the owner once when it flips to broken. */
export async function checkLink(link: CheckableLink) {
  const result = await probeUrl(link.url);
  const status = result.ok ? "ok" : "broken";
  const now = new Date();
  await db.$transaction([
    db.linkCheck.create({ data: { linkId: link.id, status: result.status, ok: result.ok, latencyMs: result.latencyMs, error: result.error } }),
    db.link.update({ where: { id: link.id }, data: { healthStatus: status, healthCode: result.status, healthCheckedAt: now } }),
  ]);
  if (status === "broken" && link.healthStatus !== "broken") await notifyBroken(link, result).catch((e) => console.error("[health] notify failed", e));
  return { ...result, healthStatus: status, checkedAt: now };
}

/** Checks the least-recently-checked active links (never-checked first). Returns a summary. */
export async function runHealthChecks(limit = 50, where: { userId?: string } = {}) {
  const links = await db.link.findMany({
    where: { status: "active", isArchived: false, url: { startsWith: "http" }, ...(where.userId ? { userId: where.userId } : {}) },
    orderBy: [{ healthCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(200, limit)),
    select: { id: true, url: true, alias: true, userId: true, healthStatus: true, fallbackUrl: true, title: true },
  });
  let ok = 0, broken = 0, flipped = 0;
  // Small concurrency pool so a batch of slow hosts does not serialize for minutes.
  const queue = [...links];
  const worker = async () => {
    for (let l = queue.shift(); l; l = queue.shift()) {
      try {
        const r = await checkLink(l);
        if (r.ok) ok++; else { broken++; if (l.healthStatus !== "broken") flipped++; }
      } catch (e) { broken++; console.error("[health] check failed", l.id, e); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, links.length) }, worker));
  return { checked: links.length, ok, broken, newlyBroken: flipped };
}

/** Counts for the health overview screen. */
export async function healthOverview(userId: string) {
  const base = { userId, isArchived: false };
  const [healthy, broken, unchecked, total] = await Promise.all([
    db.link.count({ where: { ...base, healthStatus: "ok" } }),
    db.link.count({ where: { ...base, healthStatus: "broken" } }),
    db.link.count({ where: { ...base, healthStatus: "unknown" } }),
    db.link.count({ where: base }),
  ]);
  return { healthy, broken, unchecked, total };
}
