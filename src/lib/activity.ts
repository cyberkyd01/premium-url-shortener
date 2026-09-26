import type { Prisma } from "@prisma/client";
import { db } from "./db";

export interface ActivityInput {
  /** Owner of the resource / account the event belongs to (workspace owner). */
  userId: string | null;
  /** Who performed the action when different from the owner (team member, admin). */
  actorId?: string | null;
  /** Dotted action key, e.g. link.create, link.delete, login, webhook.disabled */
  action: string;
  /** Resource type: link | bio | qr | campaign | domain | webhook | user | settings ... */
  target?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
  isAdmin?: boolean;
}

/** Human labels + icon names (lucide) for known actions; unknown actions fall back to the raw key. */
export const ACTIVITY_ACTIONS: Record<string, { label: string; icon: string; color: "green" | "red" | "yellow" | "gray" | "blue" }> = {
  "link.create": { label: "Link created", icon: "Plus", color: "green" },
  "link.update": { label: "Link updated", icon: "Pencil", color: "blue" },
  "link.delete": { label: "Link deleted", icon: "Trash2", color: "red" },
  "link.archive": { label: "Link archived", icon: "Archive", color: "gray" },
  "link.unarchive": { label: "Link restored", icon: "ArchiveRestore", color: "gray" },
  "link.pin": { label: "Link pinned", icon: "Pin", color: "blue" },
  "link.duplicate": { label: "Link duplicated", icon: "Copy", color: "blue" },
  "link.bulk": { label: "Bulk link update", icon: "Layers", color: "blue" },
  "link.import": { label: "Links imported", icon: "Upload", color: "green" },
  "login": { label: "Login", icon: "LogIn", color: "green" },
  "login.failed": { label: "Failed login", icon: "ShieldAlert", color: "red" },
  "webhook.disabled": { label: "Webhook disabled", icon: "Webhook", color: "yellow" },
  "domain.branding": { label: "Domain branding updated", icon: "Palette", color: "blue" },
  "migration.run": { label: "Migration", icon: "ArrowRightLeft", color: "green" },
};

/** Persists an activity row. Never throws (activity must not break the main flow). */
export async function logActivity(input: ActivityInput) {
  try {
    await db.activityLog.create({ data: {
      userId: input.userId, actorId: input.actorId ?? input.userId ?? null, action: input.action, target: input.target ?? null, targetId: input.targetId ?? null,
      meta: JSON.stringify(input.meta ?? {}), ip: input.ip ?? null, isAdmin: !!input.isAdmin,
    } });
  } catch (e) { console.error("[activity] failed", e); }
}

export type ActivityRow = Prisma.ActivityLogGetPayload<Record<string, never>>;

/** Latest activity rows for a user (workspace owner), newest first. */
export async function recentActivity(userId: string, take = 20): Promise<ActivityRow[]> {
  return db.activityLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export interface ActivityFilter { action?: string; from?: string; to?: string; target?: string }

/** Paginated feed used by /dashboard/activity and its CSV export. */
export async function listActivity(userId: string, filter: ActivityFilter, page = 1, perPage = 50) {
  const where: Prisma.ActivityLogWhereInput = { userId };
  if (filter.action) where.action = filter.action.endsWith(".") ? { startsWith: filter.action } : filter.action;
  if (filter.target) where.target = filter.target;
  if (filter.from || filter.to) where.createdAt = { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to + "T23:59:59") } : {}) };
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Synthesizes login events from LoginHistory (auth.ts is not instrumented directly). */
export async function syncLoginActivity(userId: string) {
  const last = await db.activityLog.findFirst({ where: { userId, action: { in: ["login", "login.failed"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const logins = await db.loginHistory.findMany({ where: { userId, ...(last ? { createdAt: { gt: last.createdAt } } : {}) }, orderBy: { createdAt: "asc" }, take: 200 });
  if (!logins.length) return 0;
  await db.activityLog.createMany({ data: logins.map((l) => ({
    userId, actorId: userId, action: l.success ? "login" : "login.failed", target: "user", targetId: userId, ip: l.ip, createdAt: l.createdAt,
    meta: JSON.stringify({ country: l.country, userAgent: l.userAgent?.slice(0, 200) }),
  })) });
  return logins.length;
}
