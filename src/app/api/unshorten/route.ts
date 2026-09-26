import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk, rateLimit } from "@/lib/api-auth";
import { corsPreflight, withCors } from "@/lib/api-helpers";
import { shortUrl } from "@/lib/links";
import { clientIp } from "@/lib/geo";
import { appHost } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/unshorten?url=<short url or alias> — public: resolves a short link to its destination + title. */
export async function GET(req: NextRequest) {
  const rl = rateLimit("unshorten:" + clientIp(req.headers), 60);
  if (!rl.ok) return withCors(apiError("Too many requests", 429));
  const raw = (req.nextUrl.searchParams.get("url") || req.nextUrl.searchParams.get("alias") || "").trim();
  if (!raw) return withCors(apiError("Missing required parameter: url"));
  let host = "";
  let alias = raw;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw.includes("/") ? raw : appHost() + "/" + raw}`);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    alias = u.pathname.split("/").filter(Boolean)[0] ?? "";
    if (alias === "u" || alias === "b" || alias === "qr") alias = u.pathname.split("/").filter(Boolean)[1] ?? alias;
  } catch { /* treat as alias */ }
  alias = alias.replace(/\+$/, "").replace(/\.html?$/, "");
  if (!alias) return withCors(apiError("Could not read an alias from that URL"));
  const mainHost = appHost().replace(/^www\./, "").toLowerCase();
  const domain = host && host !== mainHost ? await db.domain.findUnique({ where: { domain: host } }) : null;
  if (host && host !== mainHost && !domain) return withCors(apiError("Unknown domain", 404));
  const link = await db.link.findFirst({ where: { alias, domainId: domain?.id ?? null }, include: { domain: true } });
  if (!link) return withCors(apiError("Short link not found", 404));
  if (link.status !== "active") return withCors(apiError(link.status === "pending" ? "This link is awaiting approval" : "This link is disabled", 403));
  if (link.password) return withCors(apiOk({ alias: link.alias, short: shortUrl(link), url: null, title: link.title, protected: true, message: "This link is password protected" }));
  return withCors(apiOk({ alias: link.alias, short: shortUrl(link), url: link.url, title: link.title, description: link.description, expired: !!link.expiresAt && link.expiresAt < new Date(), createdAt: link.createdAt.toISOString() }));
}
