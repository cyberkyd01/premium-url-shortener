import { NextRequest, NextResponse } from "next/server";
import type { Plan } from "@prisma/client";
import { apiAuth, apiError, apiOk } from "./api-auth";
import { LinkError } from "./links";
import type { PlanFeatures, UserWithPlan } from "./plan";

export interface ApiIdentity { user: UserWithPlan; plan: Plan | null; features: PlanFeatures; isAdmin: boolean }
export type ApiAuthResult = { error: NextResponse } | ApiIdentity;

/** `apiAuth()` with a discriminated return type so `if ("error" in auth) return auth.error;` narrows correctly. */
export async function authenticate(req: NextRequest, permission?: string): Promise<ApiAuthResult> {
  const r = await apiAuth(req, permission);
  if (r.error) return { error: r.error };
  if (!r.user) return { error: apiError("Unauthorized", 401) };
  return { user: r.user, plan: r.plan ?? null, features: r.features, isAdmin: !!r.isAdmin };
}

/** Error thrown by API handlers; converted to `{error:1, message}` with the given status. */
export class ApiRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Reads a JSON or form-encoded request body. Arrays at the root are returned under `_array`. */
export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        const val = typeof v === "string" ? v : v.name;
        if (k.endsWith("[]")) {
          const key = k.slice(0, -2);
          const prev = out[key];
          out[key] = Array.isArray(prev) ? [...prev, val] : [val];
        } else out[k] = val;
      });
      return out;
    }
    const text = await req.text();
    if (!text.trim()) return {};
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return { _array: parsed };
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- coercion helpers
export function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}
export function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return undefined;
}
export function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off", ""].includes(s)) return false;
  }
  return undefined;
}
export function asArray(v: unknown): unknown[] | undefined {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { const p: unknown = JSON.parse(v); return Array.isArray(p) ? p : undefined; } catch { return undefined; }
  }
  return undefined;
}
export function asStringArray(v: unknown): string[] | undefined {
  const arr = asArray(v);
  if (arr) return arr.map(asString).filter((s): s is string => !!s);
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return undefined;
}
export function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (isRecord(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("{")) {
    try { const p: unknown = JSON.parse(v); return isRecord(p) ? p : undefined; } catch { return undefined; }
  }
  return undefined;
}
export function asStringRecord(v: unknown): Record<string, string> | undefined {
  const r = asRecord(v);
  if (!r) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(r)) { const s = asString(val); if (s !== undefined) out[k] = s; }
  return out;
}
export function asDate(v: unknown): Date | null | undefined {
  if (v === null || v === "") return null;
  const s = asString(v);
  if (s === undefined) return undefined;
  const d = new Date(/^\d+$/.test(s) ? Number(s) * (s.length <= 10 ? 1000 : 1) : s);
  if (isNaN(d.getTime())) throw new ApiRequestError("Invalid date: " + s);
  return d;
}
export function requireString(v: unknown, name: string): string {
  const s = asString(v)?.trim();
  if (!s) throw new ApiRequestError(`Missing required parameter: ${name}`);
  return s;
}

// ---------------------------------------------------------------- pagination
export interface Pagination { page: number; limit: number; skip: number }

export function paginate(req: NextRequest, defaultLimit = 25, maxLimit = 100): Pagination {
  const q = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(q.get("page") || "1", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.get("limit") || String(defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated<T>(data: T[], total: number, p: Pagination, extra: Record<string, unknown> = {}) {
  return apiOk({ data, pagination: { page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) }, ...extra });
}

/** Maps thrown errors to the JSON error envelope. */
export function handleApiError(e: unknown) {
  if (e instanceof LinkError || e instanceof ApiRequestError) return apiError(e.message, e.status);
  if (e instanceof Error && /Unique constraint/i.test(e.message)) return apiError("A record with the same unique value already exists", 409);
  console.error("[api]", e);
  return apiError("Internal server error", 500);
}

/** Wraps a handler so thrown errors become API errors and CORS headers are always present. */
export function apiHandler<Ctx>(fn: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      return withCors(await fn(req, ctx));
    } catch (e) {
      return withCors(handleApiError(e));
    }
  };
}

export type RouteCtx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };
