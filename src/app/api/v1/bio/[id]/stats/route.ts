import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { loadBio } from "@/lib/api-resources";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/bio/:id/stats?days=30 — views plus per-block click counts. */
export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const [stats, blocks] = await Promise.all([
    getStats({ bioPageId: page.id }, days),
    db.bioBlock.findMany({ where: { bioPageId: page.id }, select: { id: true, type: true, title: true, url: true, clicks: true }, orderBy: { clicks: "desc" } }),
  ]);
  return apiOk({ data: { id: page.id, alias: page.alias, days, views: page.views, uniqueViews: page.uniqueViews, blocks, ...stats } });
});
