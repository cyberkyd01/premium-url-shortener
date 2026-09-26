import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asString, corsPreflight, paginate, paginated, readBody, requireString, ApiRequestError  } from "@/lib/api-helpers";
import { serializeDomain } from "@/lib/api-serializers";
import { withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { appHost, isValidUrl, normalizeUrl, randomToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/domains — the user's custom domains plus public (admin-provided) domains. */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "domains.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const where = { OR: [{ userId: auth.user.id }, { isPublic: true, status: 1 }] };
  const [rows, total] = await Promise.all([
    db.domain.findMany({ where, orderBy: [{ isMain: "desc" }, { createdAt: "desc" }], skip: p.skip, take: p.limit, include: { _count: { select: { links: true } } } }),
    db.domain.count({ where }),
  ]);
  return paginated(rows.map((d) => serializeDomain(d, auth.user.id)), total, p, { main: appHost() });
});

/** POST /api/v1/domains {domain, rootRedirect?, notFoundRedirect?} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "domains.write");
  if ("error" in auth) return auth.error;
  const s = await getSettings();
  if (s["domains.custom"] !== "1" && !auth.isAdmin) return apiError("Custom domains are disabled", 403);
  const limit = await withinLimit(auth.user.id, "limitDomains");
  if (!limit.ok) return apiError(`You have reached your plan limit of ${limit.limit} domains`, 402);
  const body = await readBody(req);
  const raw = requireString(body.domain ?? body.host ?? body.name, "domain");
  const domain = raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").trim();
  if (!/^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/.test(domain)) throw new ApiRequestError("Invalid domain name");
  if (domain === appHost().replace(/^www\./, "")) throw new ApiRequestError("That is the main domain");
  if (await db.domain.findUnique({ where: { domain } })) throw new ApiRequestError("This domain is already registered", 409);
  const urlOrNull = (v: unknown) => { const u = asString(v)?.trim(); if (!u) return null; const n = normalizeUrl(u); if (!isValidUrl(n)) throw new ApiRequestError("Invalid redirect URL"); return n; };
  const created = await db.domain.create({
    data: {
      domain, userId: auth.user.id, rootRedirect: urlOrNull(body.rootRedirect ?? body.root), notFoundRedirect: urlOrNull(body.notFoundRedirect ?? body.notfound),
      status: s["domains.verifyDns"] === "1" && !auth.isAdmin ? 0 : 1, verifyToken: randomToken(8),
    },
    include: { _count: { select: { links: true } } },
  });
  return apiOk({ data: serializeDomain(created, auth.user.id), dns: { type: "A or CNAME", target: appHost(), txtVerification: created.status === 0 ? `pus-verify=${created.verifyToken}` : null } }, 201);
});
