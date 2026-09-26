import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, escapeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

async function pagesUrlset(s: Record<string, string>) {
  const [pages, posts, articles] = await Promise.all([
    db.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    s["blog.enabled"] === "1" ? db.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }) : Promise.resolve([]),
    s["help.enabled"] === "1" ? db.helpArticle.findMany({ where: { published: true }, select: { slug: true, updatedAt: true, category: { select: { slug: true } } } }) : Promise.resolve([]),
  ]);
  const entries: { loc: string; lastmod?: Date; priority: string }[] = [
    { loc: "/", priority: "1.0" }, { loc: "/features", priority: "0.8" }, { loc: "/contact", priority: "0.5" }, { loc: "/tools", priority: "0.5" }, { loc: "/qr-generator", priority: "0.6" }, { loc: "/developers", priority: "0.5" },
    ...(s["payments.enabled"] === "1" ? [{ loc: "/pricing", priority: "0.8" }] : []),
    ...(s["affiliate.enabled"] === "1" ? [{ loc: "/affiliate", priority: "0.5" }] : []),
    ...(s["blog.enabled"] === "1" ? [{ loc: "/blog", priority: "0.7" }] : []),
    ...(s["help.enabled"] === "1" ? [{ loc: "/help", priority: "0.6" }] : []),
    ...pages.map((p) => ({ loc: `/${p.slug}`, lastmod: p.updatedAt, priority: "0.6" })),
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: p.updatedAt, priority: "0.6" })),
    ...articles.map((a) => ({ loc: `/help/${a.category?.slug ?? "general"}/${a.slug}`, lastmod: a.updatedAt, priority: "0.5" })),
  ];
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((e) => `<url><loc>${escapeHtml(appUrl(e.loc))}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ""}<priority>${e.priority}</priority></url>`).join("\n")}\n</urlset>`;
}

/** Sitemap index (when link sitemaps are enabled) or a plain urlset of the public pages. */
export async function GET(req: Request) {
  const s = await getSettings();
  const section = new URL(req.url).searchParams.get("section");
  if (s["links.sitemap"] !== "1" || section === "pages") return xml(await pagesUrlset(s));
  const maps = ["/sitemap.xml?section=pages", "/sitemap-links.xml", ...(s["bio.enabled"] === "1" ? ["/sitemap-bio.xml"] : [])];
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${maps.map((m) => `<sitemap><loc>${escapeHtml(appUrl(m))}</loc></sitemap>`).join("\n")}\n</sitemapindex>`);
}
