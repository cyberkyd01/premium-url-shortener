import { NextRequest, NextResponse } from "next/server";
import { stringify } from "csv-stringify/sync";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { shortUrl } from "@/lib/links";

/** Dashboard export: GET /api/links/export?ids=a,b (or all links of the workspace). Requires the `export` plan feature. */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.export) return NextResponse.json({ error: 1, message: "Export is not available on your plan" }, { status: 402 });
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const links = await db.link.findMany({ where: { userId: ws.ownerId, ...(ids.length ? { id: { in: ids } } : {}) }, include: { domain: true, channel: true, campaign: true }, orderBy: { createdAt: "desc" }, take: 10000 });
  const csv = stringify(links.map((l) => ({
    short: shortUrl(l), alias: l.alias, domain: l.domain?.domain ?? "", url: l.url, title: l.title ?? "", description: l.description ?? "", redirectType: l.redirectType,
    clicks: l.clicks, uniqueClicks: l.uniqueClicks, status: l.status, channel: l.channel?.name ?? "", campaign: l.campaign?.name ?? "", archived: l.isArchived ? 1 : 0, pinned: l.isPinned ? 1 : 0,
    expiresAt: l.expiresAt?.toISOString() ?? "", createdAt: l.createdAt.toISOString(),
  })), { header: true });
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="links-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
