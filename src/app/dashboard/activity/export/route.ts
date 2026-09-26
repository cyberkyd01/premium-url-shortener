import { NextResponse, type NextRequest } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import { ACTIVITY_ACTIONS, listActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function csv(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /dashboard/activity/export?action=&from=&to= → CSV of the (filtered) activity feed, max 10k rows. */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: true, message: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const { rows } = await listActivity(ws.ownerId, { action: sp.get("action") || undefined, from: sp.get("from") || undefined, to: sp.get("to") || undefined }, 1, 10_000);
  const lines = ["date,action,label,target,target_id,actor,ip,meta"];
  for (const r of rows) lines.push([r.createdAt.toISOString(), r.action, ACTIVITY_ACTIONS[r.action]?.label ?? r.action, r.target, r.targetId, r.actorId, r.ip, r.meta].map(csv).join(","));
  return new NextResponse(lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
