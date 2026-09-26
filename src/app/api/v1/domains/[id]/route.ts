import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asString, corsPreflight, readBody, ApiRequestError, type RouteCtx  } from "@/lib/api-helpers";
import { serializeDomain } from "@/lib/api-serializers";
import { loadDomain } from "@/lib/api-resources";
import { isValidUrl, normalizeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "domains.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializeDomain(await loadDomain(id, auth.user.id, auth.isAdmin), auth.user.id) });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "domains.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const d = await loadDomain(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const data: { rootRedirect?: string | null; notFoundRedirect?: string | null } = {};
  const urlOrNull = (v: unknown) => { const u = asString(v)?.trim(); if (!u) return null; const n = normalizeUrl(u); if (!isValidUrl(n)) throw new ApiRequestError("Invalid redirect URL"); return n; };
  if ("rootRedirect" in body || "root" in body) data.rootRedirect = urlOrNull(body.rootRedirect ?? body.root);
  if ("notFoundRedirect" in body || "notfound" in body) data.notFoundRedirect = urlOrNull(body.notFoundRedirect ?? body.notfound);
  const updated = await db.domain.update({ where: { id: d.id }, data, include: { _count: { select: { links: true } } } });
  return apiOk({ data: serializeDomain(updated, auth.user.id) });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "domains.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const d = await loadDomain(id, auth.user.id, auth.isAdmin);
  if (d.isMain) throw new ApiRequestError("The main domain cannot be deleted", 403);
  await db.domain.delete({ where: { id: d.id } });
  return apiOk({ data: { id: d.id, domain: d.domain }, message: "Domain deleted. Links on it now use the main domain." });
});
