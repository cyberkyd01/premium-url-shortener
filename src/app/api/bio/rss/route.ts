import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api-auth";
import { clientIp } from "@/lib/geo";

const cache = new Map<string, { at: number; items: FeedItem[] }>();
interface FeedItem { title: string; link: string; date?: string }

const strip = (v: string) => v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
function tag(xml: string, name: string) { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? strip(m[1]) : ""; }

/** Minimal RSS 2.0 / Atom parser. */
function parseFeed(xml: string, count: number): FeedItem[] {
  const items: FeedItem[] = [];
  const rss = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  for (const it of rss) items.push({ title: tag(it, "title"), link: tag(it, "link") || (it.match(/<guid[^>]*>([^<]+)/i)?.[1] ?? ""), date: tag(it, "pubDate") || tag(it, "dc:date") || undefined });
  if (!items.length) {
    const atom = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
    for (const it of atom) items.push({ title: tag(it, "title"), link: it.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "", date: tag(it, "updated") || tag(it, "published") || undefined });
  }
  return items.filter((i) => i.title && i.link).slice(0, count);
}

/** GET ?url=&count= — fetches and parses an RSS/Atom feed server-side (cached 10 minutes). */
export async function GET(req: NextRequest) {
  if (!rateLimit("rss:" + clientIp(req.headers), 30).ok) return NextResponse.json({ items: [] }, { status: 429 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const count = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get("count") ?? "5", 10) || 5));
  if (!/^https?:\/\//.test(url)) return NextResponse.json({ items: [] }, { status: 400 });
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return NextResponse.json({ items: hit.items.slice(0, count) });
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "Mozilla/5.0 (compatible; BioRSS/1.0)" } });
    const xml = (await res.text()).slice(0, 2_000_000);
    const items = parseFeed(xml, 20);
    cache.set(url, { at: Date.now(), items });
    return NextResponse.json({ items: items.slice(0, count) });
  } catch { return NextResponse.json({ items: [] }); }
}
