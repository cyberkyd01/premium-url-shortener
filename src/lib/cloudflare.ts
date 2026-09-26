/**
 * Cloudflare for SaaS (Custom Hostnames) integration.
 *
 * Settings (admin → /admin/cloudflare):
 *  - plugin.cloudflare.enabled        "1" to provision custom hostnames automatically
 *  - plugin.cloudflare.zoneId         zone id of the SaaS zone
 *  - plugin.cloudflare.apiToken       API token with "SSL and Certificates: Edit" on the zone
 *  - plugin.cloudflare.fallbackOrigin CNAME target users point their domain to (e.g. ssl.yourdomain.com)
 */
import { db } from "./db";
import { getSetting } from "./settings";

export interface CloudflareConfig { enabled: boolean; zoneId: string; apiToken: string; fallbackOrigin: string; configured: boolean }

export async function cloudflareConfig(): Promise<CloudflareConfig> {
  const [enabled, zoneId, apiToken, fallbackOrigin] = await Promise.all([
    getSetting("plugin.cloudflare.enabled"), getSetting("plugin.cloudflare.zoneId"), getSetting("plugin.cloudflare.apiToken"), getSetting("plugin.cloudflare.fallbackOrigin"),
  ]);
  const configured = !!(zoneId.trim() && apiToken.trim());
  return { enabled: enabled === "1" && configured, zoneId: zoneId.trim(), apiToken: apiToken.trim(), fallbackOrigin: fallbackOrigin.trim(), configured };
}

export class CloudflareError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface CustomHostname { id: string; hostname: string; status: string; sslStatus: string; verificationErrors: string[]; ownership?: { type?: string; name?: string; value?: string } | null }

function rec(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}; }
function s(v: unknown) { return v === null || v === undefined ? "" : String(v); }

async function api(cfg: CloudflareConfig, method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfg.zoneId}${path}`, {
    method, headers: { authorization: `Bearer ${cfg.apiToken}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const d = rec(await r.json().catch(() => ({})));
  if (!r.ok || d.success === false) {
    const errors = Array.isArray(d.errors) ? (d.errors as unknown[]).map((e) => s(rec(e).message)).filter(Boolean) : [];
    throw new CloudflareError(errors.join("; ") || `Cloudflare API error (${r.status})`, r.status === 401 || r.status === 403 ? 401 : 400);
  }
  return d;
}

function toHostname(raw: unknown): CustomHostname {
  const d = rec(raw);
  const ssl = rec(d.ssl);
  const errs = Array.isArray(d.verification_errors) ? (d.verification_errors as unknown[]).map(s) : Array.isArray(ssl.validation_errors) ? (ssl.validation_errors as unknown[]).map((e) => s(rec(e).message)) : [];
  const own = rec(d.ownership_verification);
  return { id: s(d.id), hostname: s(d.hostname), status: s(d.status) || "pending", sslStatus: s(ssl.status) || "pending", verificationErrors: errs, ownership: own.name ? { type: s(own.type), name: s(own.name), value: s(own.value) } : null };
}

/** Creates (or re-uses) a custom hostname with HTTP DV certificate validation. */
export async function createCustomHostname(hostname: string, cfg?: CloudflareConfig): Promise<CustomHostname> {
  const c = cfg ?? (await cloudflareConfig());
  if (!c.configured) throw new CloudflareError("Cloudflare is not configured", 503);
  try {
    const d = await api(c, "POST", "/custom_hostnames", { hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } });
    return toHostname(d.result);
  } catch (e) {
    // Already exists → look it up.
    if (e instanceof CloudflareError && /already|duplicate|exists/i.test(e.message)) {
      const list = await api(c, "GET", `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
      const first = Array.isArray(list.result) ? (list.result as unknown[])[0] : null;
      if (first) return toHostname(first);
    }
    throw e;
  }
}

export async function getCustomHostname(id: string, cfg?: CloudflareConfig): Promise<CustomHostname> {
  const c = cfg ?? (await cloudflareConfig());
  if (!c.configured) throw new CloudflareError("Cloudflare is not configured", 503);
  const d = await api(c, "GET", `/custom_hostnames/${encodeURIComponent(id)}`);
  return toHostname(d.result);
}

export async function deleteCustomHostname(id: string, cfg?: CloudflareConfig): Promise<void> {
  const c = cfg ?? (await cloudflareConfig());
  if (!c.configured) return;
  await api(c, "DELETE", `/custom_hostnames/${encodeURIComponent(id)}`).catch((e: unknown) => { if (!(e instanceof CloudflareError && /not found/i.test(e.message))) throw e; });
}

/** Provisions a Domain row on Cloudflare and stores the hostname id + status. Never throws (stores "error" instead). */
export async function provisionHostname(domain: { id: string; domain: string; cfHostnameId: string | null }): Promise<{ ok: boolean; status: string; sslStatus: string; message: string }> {
  const cfg = await cloudflareConfig();
  if (!cfg.enabled) return { ok: false, status: "disabled", sslStatus: "", message: "Cloudflare SSL is disabled" };
  try {
    const h = domain.cfHostnameId ? await getCustomHostname(domain.cfHostnameId, cfg).catch(() => createCustomHostname(domain.domain, cfg)) : await createCustomHostname(domain.domain, cfg);
    await db.domain.update({ where: { id: domain.id }, data: { cfHostnameId: h.id, cfStatus: h.status, cfSslStatus: h.sslStatus } });
    return { ok: true, status: h.status, sslStatus: h.sslStatus, message: h.status === "active" && h.sslStatus === "active" ? "SSL certificate is active." : `Hostname ${h.status}, certificate ${h.sslStatus}.${h.verificationErrors.length ? " " + h.verificationErrors.join(" ") : ""}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cloudflare error";
    await db.domain.update({ where: { id: domain.id }, data: { cfStatus: "error", cfSslStatus: message.slice(0, 200) } }).catch(() => undefined);
    return { ok: false, status: "error", sslStatus: "", message };
  }
}

/** Re-reads the hostname status from Cloudflare and updates the Domain row. */
export async function refreshHostname(domain: { id: string; domain: string; cfHostnameId: string | null }) {
  return provisionHostname(domain);
}

export async function removeHostname(domain: { cfHostnameId: string | null }) {
  if (!domain.cfHostnameId) return;
  const cfg = await cloudflareConfig();
  if (!cfg.configured) return;
  await deleteCustomHostname(domain.cfHostnameId, cfg).catch((e: unknown) => console.error("[cloudflare] delete hostname failed", e));
}

/** Verifies the credentials by fetching the zone (used by the admin "Test connection" button). */
export async function testCloudflare(cfg?: CloudflareConfig): Promise<{ ok: boolean; message: string }> {
  const c = cfg ?? (await cloudflareConfig());
  if (!c.configured) return { ok: false, message: "Zone ID and API token are required." };
  try {
    const d = await api(c, "GET", "");
    const zone = rec(d.result);
    const fb = await api(c, "GET", "/custom_hostnames/fallback_origin").catch(() => null);
    const origin = fb ? s(rec(fb.result).origin) : "";
    return { ok: true, message: `Connected to zone ${s(zone.name) || c.zoneId}.${origin ? ` Fallback origin: ${origin}.` : " No fallback origin set on Cloudflare yet."}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
