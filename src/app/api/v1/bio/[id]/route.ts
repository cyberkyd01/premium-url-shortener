import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializeBio } from "@/lib/api-serializers";
import { loadBio } from "@/lib/api-resources";
import { bioDataFromBody } from "@/lib/api-bio";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializeBio(await loadBio(id, auth.user.id, auth.isAdmin)) });
});

/** PUT /api/v1/bio/:id — update profile fields, theme, layout, colors, socials, seo, password, status... */
export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  const data = await bioDataFromBody(await readBody(req), page);
  const updated = await db.bioPage.update({ where: { id: page.id }, data, include: { domain: true, blocks: { orderBy: { order: "asc" } }, _count: { select: { blocks: true } } } });
  return apiOk({ data: serializeBio(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  await db.bioPage.delete({ where: { id: page.id } });
  return apiOk({ data: { id: page.id, alias: page.alias }, message: "Bio page deleted" });
});
