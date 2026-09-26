import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticate, apiHandler, corsPreflight, paginate, paginated, type RouteCtx  } from "@/lib/api-helpers";
import { loadLink } from "@/lib/api-links";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/links/:id/clicks?page=&limit= — most recent clicks (bots excluded). */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const link = await loadLink(id, auth.user.id, auth.isAdmin);
  const p = paginate(req, 50);
  const where = { linkId: link.id, isBot: false };
  const [rows, total] = await Promise.all([
    db.click.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit }),
    db.click.count({ where }),
  ]);
  const data = rows.map((c) => ({
    id: c.id, country: c.country, countryCode: c.countryCode, region: c.region, city: c.city, referer: c.referer, refererHost: c.refererHost,
    browser: c.browser, os: c.os, device: c.device, language: c.language, unique: c.isUnique, targetUrl: c.targetUrl,
    utm: { source: c.utmSource, medium: c.utmMedium, campaign: c.utmCampaign }, createdAt: c.createdAt.toISOString(),
  }));
  return paginated(data, total, p, { id: link.id, alias: link.alias });
});
