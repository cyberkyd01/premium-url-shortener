import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, escapeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

function cdata(v: string) { return `<![CDATA[${v.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`; }
function stripHtml(v: string) { return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

/** GET /blog/feed.xml — RSS 2.0 feed of the latest 20 published posts. */
export async function GET() {
  const s = await getSettings();
  if (s["blog.enabled"] !== "1") return new NextResponse("Not found", { status: 404 });
  const posts = await db.blogPost.findMany({ where: { published: true }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 20, include: { category: { select: { name: true } }, author: { select: { name: true, username: true } } } });
  const site = s["site.name"];
  const link = appUrl("/blog");
  const items = posts.map((p) => {
    const url = appUrl(`/blog/${p.slug}`);
    const description = p.excerpt?.trim() || stripHtml(p.content).slice(0, 400);
    const date = (p.publishedAt ?? p.createdAt).toUTCString();
    return [
      "<item>",
      `<title>${cdata(p.title)}</title>`,
      `<link>${escapeHtml(url)}</link>`,
      `<guid isPermaLink="true">${escapeHtml(url)}</guid>`,
      `<description>${cdata(description)}</description>`,
      `<pubDate>${date}</pubDate>`,
      p.category ? `<category>${cdata(p.category.name)}</category>` : "",
      p.author ? `<dc:creator>${cdata(p.author.name || p.author.username)}</dc:creator>` : "",
      p.image ? `<enclosure url="${escapeHtml(p.image.startsWith("http") ? p.image : appUrl(p.image))}" type="image/${(p.image.split(".").pop() ?? "jpeg").toLowerCase() === "png" ? "png" : "jpeg"}" length="0" />` : "",
      "</item>",
    ].filter(Boolean).join("");
  }).join("\n");
  const lastBuild = (posts[0]?.publishedAt ?? posts[0]?.createdAt ?? new Date()).toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>${cdata(`${site} Blog`)}</title>
<link>${escapeHtml(link)}</link>
<atom:link href="${escapeHtml(appUrl("/blog/feed.xml"))}" rel="self" type="application/rss+xml" />
<description>${cdata(s["site.description"] || "News, guides and tips.")}</description>
<language>${escapeHtml(s["site.defaultLanguage"] || "en")}</language>
<lastBuildDate>${lastBuild}</lastBuildDate>
<generator>${escapeHtml(site)}</generator>
${items}
</channel>
</rss>`;
  return new NextResponse(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}
