import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, escapeHtml } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Active, non-password-protected bio pages. */
export async function GET() {
  const s = await getSettings();
  if (s["links.sitemap"] !== "1" || s["bio.enabled"] !== "1") return new Response("Not found", { status: 404 });
  const pages = await db.bioPage.findMany({
    where: { status: "active", password: null, isTemplate: false },
    select: { alias: true, updatedAt: true, domain: { select: { domain: true } }, seo: true }, orderBy: { updatedAt: "desc" }, take: 5000,
  });
  const visible = pages.filter((p) => { try { return !(JSON.parse(p.seo) as { noindex?: boolean }).noindex; } catch { return true; } });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${visible.map((p) => `<url><loc>${escapeHtml(p.domain ? `https://${p.domain.domain}/${p.alias}` : appUrl(`/${p.alias}`))}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><priority>0.4</priority></url>`).join("\n")}\n</urlset>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
