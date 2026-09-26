import dns from "dns";
import { appHost } from "./utils";

export const DOMAIN_CHECK_TEXT = "Your domain name is working";

export function isValidHostname(v: string) {
  return /^(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/.test(v) && v.length <= 253;
}
export function normalizeHostname(v: string) {
  return v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}

/** Hostname (without port) of the application. */
export function appHostname() {
  return appHost().split(":")[0];
}

/** Resolves the IP(s) the app host points to (SERVER_IP env wins). */
export async function serverIps(): Promise<string[]> {
  if (process.env.SERVER_IP) return process.env.SERVER_IP.split(",").map((s) => s.trim()).filter(Boolean);
  try { return await dns.promises.resolve4(appHostname()); } catch { return []; }
}

/** Checks that a custom domain points to this server via CNAME, A record, or by fetching /domain-check. */
export async function verifyDomain(domain: string): Promise<{ ok: boolean; method?: "cname" | "a" | "http"; message: string }> {
  const host = appHostname();
  try {
    const cnames = await dns.promises.resolveCname(domain);
    if (cnames.some((c) => c.replace(/\.$/, "").toLowerCase() === host.toLowerCase())) return { ok: true, method: "cname", message: `CNAME record points to ${host}` };
  } catch { /* no CNAME */ }
  const ips = await serverIps();
  if (ips.length) {
    try {
      const a = await dns.promises.resolve4(domain);
      if (a.some((ip) => ips.includes(ip))) return { ok: true, method: "a", message: `A record points to ${a.join(", ")}` };
    } catch { /* no A record */ }
  }
  for (const proto of ["https", "http"]) {
    try {
      const res = await fetch(`${proto}://${domain}/domain-check`, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "domain-verifier" } });
      const text = await res.text();
      if (text.includes(DOMAIN_CHECK_TEXT)) return { ok: true, method: "http", message: `${domain} responds correctly` };
    } catch { /* unreachable */ }
  }
  return { ok: false, message: `${domain} does not point to this server yet. DNS changes can take up to 24 hours to propagate.` };
}
