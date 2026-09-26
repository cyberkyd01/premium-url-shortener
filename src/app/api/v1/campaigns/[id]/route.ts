import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, asString, corsPreflight, readBody, ApiRequestError, type RouteCtx  } from "@/lib/api-helpers";
import { serializeCampaign, serializeLink } from "@/lib/api-serializers";
import { LINK_INCLUDE } from "@/lib/api-links";
import { loadCampaign } from "@/lib/api-resources";
import { isAliasAvailable } from "@/lib/links";
import { isValidAlias, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  const links = await db.link.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "desc" }, take: 100, include: LINK_INCLUDE });
  return apiOk({ data: { ...serializeCampaign(c), links: links.map(serializeLink) } });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const data: Prisma.CampaignUpdateInput = {};
  const name = asString(body.name)?.trim();
  if (name) data.name = name.slice(0, 100);
  const slug = asString(body.slug);
  if (slug) {
    const s = slugify(slug);
    if (s !== c.slug && (await db.campaign.findUnique({ where: { slug: s } }))) throw new ApiRequestError("Slug already in use");
    data.slug = s;
  }
  if ("description" in body) data.description = asString(body.description)?.slice(0, 500) || null;
  const color = asString(body.color);
  if (color) data.color = color;
  const isPublic = asBool(body.isPublic ?? body.public);
  if (isPublic !== undefined) data.isPublic = isPublic;
  const isRotator = asBool(body.isRotator ?? body.rotator);
  if (isRotator !== undefined) data.isRotator = isRotator;
  const rotatorAlias = asString(body.rotatorAlias);
  if (rotatorAlias !== undefined) {
    if (rotatorAlias) {
      if (!isValidAlias(rotatorAlias)) throw new ApiRequestError("Invalid rotator alias");
      if (rotatorAlias !== c.rotatorAlias && (!(await isAliasAvailable(rotatorAlias, null)) || (await db.campaign.findUnique({ where: { rotatorAlias } })))) throw new ApiRequestError("Rotator alias is already taken");
      data.rotatorAlias = rotatorAlias;
    } else data.rotatorAlias = null;
  }
  const rotatorMode = asString(body.rotatorMode);
  if (rotatorMode) {
    if (!["sequential", "random", "weighted"].includes(rotatorMode)) throw new ApiRequestError("Invalid rotatorMode");
    data.rotatorMode = rotatorMode;
  }
  const updated = await db.campaign.update({ where: { id: c.id }, data, include: { _count: { select: { links: true } } } });
  return apiOk({ data: serializeCampaign(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  await db.campaign.delete({ where: { id: c.id } });
  return apiOk({ data: { id: c.id }, message: "Campaign deleted. Links were kept." });
});
