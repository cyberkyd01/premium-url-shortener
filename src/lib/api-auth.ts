import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";
import { getSettings } from "./settings";
import { getUserPlan } from "./plan";

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  b.count++;
  return { ok: limit <= 0 || b.count <= limit, remaining: Math.max(0, limit - b.count) };
}

export function apiError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: 1, message, ...extra }, { status });
}
export function apiOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ error: 0, ...data }, { status });
}

/** Authenticates an API request using `Authorization: Bearer <key>` or `?key=`.
 *  Supports the legacy single user apiKey and the multi-key ApiKey table with permissions. */
export async function apiAuth(req: NextRequest, permission?: string) {
  const s = await getSettings();
  if (s["api.enabled"] !== "1") return { error: apiError("API is disabled", 503) };
  const header = req.headers.get("authorization") || "";
  const key = header.replace(/^Bearer\s+/i, "").trim() || req.nextUrl.searchParams.get("key") || "";
  if (!key) return { error: apiError("Missing API key", 401) };
  let userId: string | null = null;
  let perms: string[] = ["*"];
  const apiKey = await db.apiKey.findUnique({ where: { key } });
  if (apiKey) {
    if (!apiKey.active || (apiKey.expiresAt && apiKey.expiresAt < new Date())) return { error: apiError("API key inactive or expired", 401) };
    userId = apiKey.userId;
    try { perms = JSON.parse(apiKey.permissions); } catch { perms = ["*"]; }
    await db.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(), requests: { increment: 1 } } }).catch(() => {});
  } else {
    const u = await db.user.findUnique({ where: { apiKey: key } });
    if (u) userId = u.id;
  }
  if (!userId) return { error: apiError("Invalid API key", 401) };
  const { user, plan, features } = await getUserPlan(userId);
  if (user.status !== 1) return { error: apiError("Account inactive", 403) };
  if (user.role !== "admin" && !features.api) return { error: apiError("Your plan does not include API access", 403) };
  const limit = parseInt(s["api.rateLimit"] || "60", 10);
  const rl = rateLimit("api:" + userId, limit);
  if (!rl.ok) return { error: apiError("Rate limit exceeded", 429) };
  if (permission && !(perms.includes("*") || perms.includes(permission) || perms.includes(permission.split(".")[0] + ".*"))) {
    return { error: apiError("API key lacks permission: " + permission, 403) };
  }
  return { user, plan, features, isAdmin: user.role === "admin" };
}
