import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { json } from "@/lib/utils";

/** GET ?pageId=&type=&format=csv — exports bio page submissions for the owning workspace. */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const pageId = req.nextUrl.searchParams.get("pageId") ?? "";
  const type = req.nextUrl.searchParams.get("type") ?? "";
  const page = await db.bioPage.findFirst({ where: { id: pageId, userId: ws.ownerId }, select: { id: true, alias: true } });
  if (!page) return NextResponse.json({ error: 1, message: "Not found" }, { status: 404 });
  const rows = await db.bioSubmission.findMany({ where: { bioPageId: page.id, ...(type ? { type } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 });
  const keys = new Set<string>();
  const parsed = rows.map((r) => { const d = json<Record<string, string>>(r.data, {}); Object.keys(d).forEach((k) => keys.add(k)); return { r, d }; });
  const cols = ["date", "type", "blockId", ...keys];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...parsed.map(({ r, d }) => [r.createdAt.toISOString(), r.type, r.blockId ?? "", ...[...keys].map((k) => d[k] ?? "")].map(esc).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bio-${page.alias}-submissions.csv"` } });
}
