import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { loadLink } from "@/lib/api-links";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/links/:id/stats?days=30 */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const link = await loadLink(id, auth.user.id, auth.isAdmin);
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const stats = await getStats({ linkId: link.id }, days);
  return apiOk({ data: { id: link.id, alias: link.alias, days, clicks: link.clicks, uniqueClicks: link.uniqueClicks, ...stats } });
});
