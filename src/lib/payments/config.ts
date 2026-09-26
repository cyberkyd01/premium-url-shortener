import { db } from "@/lib/db";
import { json } from "@/lib/utils";

export interface GatewayConfig { config: Record<string, string>; mode: string; enabled: boolean }

/** Loads credentials for a gateway from the PaymentGateway table (config JSON). */
export async function gatewayConfig(slug: string): Promise<GatewayConfig> {
  const row = await db.paymentGateway.findUnique({ where: { slug } });
  return { config: json<Record<string, string>>(row?.config, {}), mode: row?.mode ?? "sandbox", enabled: row?.enabled ?? false };
}

export async function readBody(req: Request) {
  const raw = await req.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { /* form or empty */ }
  return { raw, data };
}

export function num(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return isNaN(n) ? fallback : n;
}
export function str(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}
export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
