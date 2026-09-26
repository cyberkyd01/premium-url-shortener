import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;

interface PageMeta { url: string; title: string | null; description: string | null; image: string | null; favicon: string | null; siteName: string | null }

function decodeEntities(s: string) {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27|apos|nbsp);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'", apos: "'", nbsp: " " })[e] ?? _).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10))).trim();
}

/** Reads `<meta property|name="key" content="...">` in either attribute order. */
function metaTag(html: string, key: string) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`, "i"),
  ];
  for (const p of patterns) { const m = html.match(p); if (m?.[1]) return decodeEntities(m[1]); }
  return null;
}

function linkTag(html: string, rels: string[]) {
  for (const rel of rels) {
    const r = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<link[^>]+rel=["'](?:[^"']*\\s)?${r}(?:\\s[^"']*)?["'][^>]*href=["']([^"']+)["']`, "i"),
      new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:[^"']*\\s)?${r}(?:\\s[^"']*)?["']`, "i"),
    ];
    for (const p of patterns) { const m = html.match(p); if (m?.[1]) return decodeEntities(m[1]); }
  }
  return null;
}

function absolute(base: string, href: string | null) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch { return null; }
}

async function fetchLimited(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; PremiumURLShortener-MetaBot/1.0)", accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" }, cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ct)) { await res.body?.cancel().catch(() => {}); return { res, html: "" }; }
    const reader = res.body?.getReader();
    if (!reader) return { res, html: await res.text() };
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); received += value.length;
    }
    await reader.cancel().catch(() => {});
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const charset = /charset=([\w-]+)/i.exec(ct)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.toString("latin1"))?.[1] ?? "utf-8";
    let html: string;
    try { html = new TextDecoder(charset).decode(buf); } catch { html = buf.toString("utf8"); }
    return { res, html };
  } finally { clearTimeout(timer); }
}

function parseMeta(url: string, html: string): PageMeta {
  const head = html.slice(0, MAX_BYTES);
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = metaTag(head, "og:title") || metaTag(head, "twitter:title") || (titleTag ? decodeEntities(titleTag.replace(/\s+/g, " ")) : null);
  const description = metaTag(head, "og:description") || metaTag(head, "twitter:description") || metaTag(head, "description");
  const image = absolute(url, metaTag(head, "og:image") || metaTag(head, "og:image:url") || metaTag(head, "twitter:image") || metaTag(head, "twitter:image:src"));
  const favicon = absolute(url, linkTag(head, ["apple-touch-icon", "icon", "shortcut icon"])) || absolute(url, "/favicon.ico");
  const siteName = metaTag(head, "og:site_name") || metaTag(head, "application-name") || (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } })();
  return { url, title: title?.slice(0, 300) ?? null, description: description?.slice(0, 500) ?? null, image, favicon, siteName };
}

function isPrivateHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return h.startsWith("[") || h === "::1";
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** GET /api/meta?url= — fetches a page (5s, 512KB) and returns its Open Graph / Twitter / title metadata. Auth required. */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const rl = rateLimit("meta:" + user.id, 30);
  if (!rl.ok) return NextResponse.json({ error: 1, message: "Rate limit exceeded, try again in a minute" }, { status: 429 });
  const raw = (req.nextUrl.searchParams.get("url") || "").trim();
  let target: URL;
  try { target = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : "https://" + raw); } catch { return NextResponse.json({ error: 1, message: "Invalid URL" }, { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol) || isPrivateHost(target.hostname)) return NextResponse.json({ error: 1, message: "Unsupported URL" }, { status: 400 });
  try {
    const { res, html } = await fetchLimited(target.toString());
    const meta = parseMeta(res.url || target.toString(), html);
    return NextResponse.json({ error: 0, status: res.status, ...meta }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    return NextResponse.json({ error: 1, message: timeout ? "The page took too long to respond" : "Could not fetch the page" }, { status: 502 });
  }
}
