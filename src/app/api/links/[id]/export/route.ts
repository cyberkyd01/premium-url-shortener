import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { daysAgo } from "@/lib/utils";

/** Dashboard export of a link's clicks: GET /api/links/{id}/export?days=30 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  if (!can(ws, "links", "stats")) return NextResponse.json({ error: 1, message: "Forbidden" }, { status: 403 });
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.export) return NextResponse.json({ error: 1, message: "Export is not available on your plan" }, { status: 402 });
  const { id } = await params;
  const link = await db.link.findFirst({ where: { id, userId: ws.ownerId } });
  if (!link) return NextResponse.json({ error: 1, message: "Not found" }, { status: 404 });
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30));
  const clicks = await db.click.findMany({ where: { linkId: id, createdAt: { gte: daysAgo(days) } }, orderBy: { createdAt: "desc" }, take: 50000 });
  const csv = stringify(clicks.map((c) => ({
    date: c.createdAt.toISOString(), country: c.countryCode ?? "", region: c.region ?? "", city: c.city ?? "", referer: c.refererHost ?? "", browser: c.browser ?? "", os: c.os ?? "",
    device: c.device ?? "", language: c.language ?? "", unique: c.isUnique ? 1 : 0, bot: c.isBot ? 1 : 0, target: c.targetUrl ?? "", utmSource: c.utmSource ?? "", utmMedium: c.utmMedium ?? "", utmCampaign: c.utmCampaign ?? "",
  })), { header: true });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="clicks-${link.alias}.csv"` } });
}
