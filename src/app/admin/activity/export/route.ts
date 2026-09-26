import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiAdmin } from "@/lib/admin/guard";
import { csv } from "@/lib/admin/query";
import { ACTIVITY_ACTIONS } from "@/lib/activity";
import { readActivityFilters, activityWhere } from "../filters";

export const dynamic = "force-dynamic";

/** GET /admin/activity/export?user=&action=&admin=&from=&to= → CSV of the filtered global audit trail (max 10k rows). */
export async function GET(req: NextRequest) {
  const admin = await apiAdmin("dashboard.view");
  if (!admin) return NextResponse.json({ error: true, message: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const filters = readActivityFilters((k) => sp.get(k) ?? "");
  const rows = await db.activityLog.findMany({ where: activityWhere(filters), orderBy: { createdAt: "desc" }, take: 10_000, include: { user: { select: { username: true, email: true } } } });
  const body = csv(rows.map((r) => ({
    date: r.createdAt.toISOString(), action: r.action, label: ACTIVITY_ACTIONS[r.action]?.label ?? r.action,
    user_id: r.userId, username: r.user?.username ?? "", email: r.user?.email ?? "", actor_id: r.actorId, is_admin: r.isAdmin ? 1 : 0,
    target: r.target, target_id: r.targetId, ip: r.ip, meta: r.meta,
  })));
  return new NextResponse(body || "date,action,label,user_id,username,email,actor_id,is_admin,target,target_id,ip,meta", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="activity-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
