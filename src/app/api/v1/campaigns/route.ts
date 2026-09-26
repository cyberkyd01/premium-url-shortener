import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, asString, corsPreflight, paginate, paginated, readBody, requireString, ApiRequestError  } from "@/lib/api-helpers";
import { serializeCampaign } from "@/lib/api-serializers";
import { withinLimit } from "@/lib/plan";
import { isAliasAvailable } from "@/lib/links";
import { isValidAlias, slugify, randomAlias } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "campaigns.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const search = req.nextUrl.searchParams.get("search") || undefined;
  const where = { userId: auth.user.id, ...(search ? { name: { contains: search } } : {}) };
  const [rows, total] = await Promise.all([
    db.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { _count: { select: { links: true } } } }),
    db.campaign.count({ where }),
  ]);
  return paginated(rows.map(serializeCampaign), total, p);
});

/** POST /api/v1/campaigns {name, slug?, description?, color?, isPublic?, isRotator?, rotatorAlias?, rotatorMode?} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "campaigns.write");
  if ("error" in auth) return auth.error;
  const limit = await withinLimit(auth.user.id, "limitCampaigns");
  if (!limit.ok) return apiError(`You have reached your plan limit of ${limit.limit} campaigns`, 402);
  const body = await readBody(req);
  const name = requireString(body.name, "name").slice(0, 100);
  let slug = slugify(asString(body.slug) || name) || randomAlias(8);
  while (await db.campaign.findUnique({ where: { slug } })) slug = `${slug}-${randomAlias(4).toLowerCase()}`;
  const isRotator = asBool(body.isRotator ?? body.rotator) ?? false;
  let rotatorAlias: string | null = null;
  if (isRotator) {
    rotatorAlias = asString(body.rotatorAlias)?.trim() || randomAlias(6);
    if (!isValidAlias(rotatorAlias)) throw new ApiRequestError("Invalid rotator alias");
    if (!(await isAliasAvailable(rotatorAlias, null)) || (await db.campaign.findUnique({ where: { rotatorAlias } }))) throw new ApiRequestError("Rotator alias is already taken");
  }
  const rotatorMode = asString(body.rotatorMode) ?? "sequential";
  if (!["sequential", "random", "weighted"].includes(rotatorMode)) throw new ApiRequestError("Invalid rotatorMode");
  const c = await db.campaign.create({
    data: { name, slug, userId: auth.user.id, description: asString(body.description)?.slice(0, 500) || null, color: asString(body.color) || "#6366f1", isPublic: asBool(body.isPublic ?? body.public) ?? false, isRotator, rotatorAlias, rotatorMode },
    include: { _count: { select: { links: true } } },
  });
  return apiOk({ data: serializeCampaign(c) }, 201);
});
