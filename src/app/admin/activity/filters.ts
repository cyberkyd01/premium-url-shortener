import type { Prisma } from "@prisma/client";

export interface ActivityFilters { user: string; action: string; admin: string; from: string; to: string }

/** Reads the filter values from a search-params getter (page `qs()` or `URLSearchParams.get`). */
export function readActivityFilters(get: (key: string) => string): ActivityFilters {
  return { user: get("user").trim(), action: get("action").trim(), admin: get("admin").trim(), from: get("from").trim(), to: get("to").trim() };
}

/** Prisma where clause shared by the list page and the CSV export. */
export function activityWhere(f: ActivityFilters): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};
  if (f.user) where.OR = [{ user: { OR: [{ username: { contains: f.user } }, { email: { contains: f.user } }] } }, { userId: f.user }, { actorId: f.user }];
  if (f.action) where.action = { startsWith: f.action };
  if (f.admin === "1") where.isAdmin = true;
  else if (f.admin === "0") where.isAdmin = false;
  if (f.from || f.to) {
    const range: Prisma.DateTimeFilter = {};
    if (f.from) { const d = new Date(f.from); if (!isNaN(d.getTime())) range.gte = d; }
    if (f.to) { const d = new Date(f.to + "T23:59:59"); if (!isNaN(d.getTime())) range.lte = d; }
    where.createdAt = range;
  }
  return where;
}

/** Query string that reproduces the filters (used for the export link). */
export function activityQuery(f: ActivityFilters): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) u.set(k, v);
  return u.toString();
}
