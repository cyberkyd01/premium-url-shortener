import type { Domain } from "@prisma/client";
import { db } from "./db";
import { appHost } from "./utils";

export interface HostContext {
  /** Domain id links are matched against (null on the main host). */
  domainId: string | null;
  domain: Domain | null;
  /** True when the request host is neither the app host nor a registered domain. */
  unknown: boolean;
  isMain: boolean;
  host: string;
}

function variants(host: string) {
  const h = host.toLowerCase();
  const noPort = h.replace(/:\d+$/, "");
  const noWww = noPort.replace(/^www\./, "");
  return [...new Set([h, noPort, noWww, "www." + noWww])];
}

/** Maps the request `host` header to the main host or a custom Domain row. */
export async function resolveHost(host: string | null): Promise<HostContext> {
  const h = (host || "").toLowerCase();
  const app = appHost().toLowerCase();
  const main: HostContext = { domainId: null, domain: null, unknown: false, isMain: true, host: h };
  if (!h || variants(h).includes(app) || variants(app).includes(h) || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h)) return main;
  const domain = await db.domain.findFirst({ where: { domain: { in: variants(h) } } });
  if (!domain) return { ...main, unknown: true, isMain: false };
  if (domain.isMain) return { ...main, domain };
  if (domain.status !== 1) return { domainId: domain.id, domain, unknown: true, isMain: false, host: h };
  return { domainId: domain.id, domain, unknown: false, isMain: false, host: h };
}
