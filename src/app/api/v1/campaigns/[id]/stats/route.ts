import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { loadCampaign } from "@/lib/api-resources";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/campaigns/:id/stats?days=30 — aggregated stats across every link of the campaign. */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const links = await db.link.findMany({ where: { campaignId: c.id }, select: { id: true, alias: true, clicks: true, uniqueClicks: true } });
  const stats = links.length ? await getStats({ linkIds: links.map((l) => l.id) }, days) : null;
  return apiOk({
    data: {
      id: c.id, name: c.name, days, links: links.length,
      clicks: links.reduce((s, l) => s + l.clicks, 0), uniqueClicks: links.reduce((s, l) => s + l.uniqueClicks, 0),
      topLinks: [...links].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
      ...(stats ?? { total: 0, unique: 0, byDay: [], byHour: [], countries: [], cities: [], regions: [], referers: [], browsers: [], os: [], devices: [], languages: [], targets: [], utmSources: [], utmMediums: [], utmCampaigns: [], heatmap: [] }),
    },
  });
});
