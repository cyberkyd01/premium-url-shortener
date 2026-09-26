import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { shortUrl } from "@/lib/links";
import { escapeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Public, active short links (main domain and public domains). Limited to the most recent 5000. */
export async function GET() {
  const s = await getSettings();
  if (s["links.sitemap"] !== "1") return new Response("Not found", { status: 404 });
  const links = await db.link.findMany({
    where: { status: "active", isPublic: true, isArchived: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { alias: true, updatedAt: true, domain: { select: { domain: true } } }, orderBy: { createdAt: "desc" }, take: 5000,
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${links.map((l) => `<url><loc>${escapeHtml(shortUrl(l))}</loc><lastmod>${l.updatedAt.toISOString()}</lastmod><priority>0.3</priority></url>`).join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
