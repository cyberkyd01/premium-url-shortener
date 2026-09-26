import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asArray, corsPreflight, isRecord, paginate, paginated, readBody, requireString  } from "@/lib/api-helpers";
import { serializeBio } from "@/lib/api-serializers";
import { bioDataFromBody, blockFromBody, validateBioAlias } from "@/lib/api-bio";
import { resolveDomainId } from "@/lib/api-links";
import { withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/bio?search=&page=&limit= */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "bio.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const search = req.nextUrl.searchParams.get("search");
  const where: Prisma.BioPageWhereInput = { userId: auth.user.id, isTemplate: false, ...(search ? { OR: [{ alias: { contains: search } }, { name: { contains: search } }] } : {}) };
  const [rows, total] = await Promise.all([
    db.bioPage.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { domain: true, _count: { select: { blocks: true } } } }),
    db.bioPage.count({ where }),
  ]);
  return paginated(rows.map(serializeBio), total, p);
});

/** POST /api/v1/bio {alias, name?, bio?, theme?, domain?, blocks?: [{type,title,url,content}]} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const s = await getSettings();
  if (s["bio.enabled"] !== "1" && !auth.isAdmin) return apiError("Bio pages are disabled", 403);
  const limit = await withinLimit(auth.user.id, "limitBioPages");
  if (!limit.ok) return apiError(`You have reached your plan limit of ${limit.limit} bio pages`, 402);
  const body = await readBody(req);
  const alias = requireString(body.alias, "alias");
  const domainId = (await resolveDomainId(body.domain ?? body.domainId, auth.user.id, auth.isAdmin)) ?? null;
  if (domainId && !auth.isAdmin && !auth.features.bioCustomDomain) return apiError("Custom domains for bio pages are not available on your plan", 402);
  await validateBioAlias(alias, domainId);
  const fields = await bioDataFromBody({ ...body, alias: undefined });
  const blocks = (asArray(body.blocks) ?? []).filter(isRecord).map((b, i) => ({ ...blockFromBody(b), order: i }));
  const { alias: _ignored, ...rest } = fields;
  void _ignored;
  const created = await db.bioPage.create({
    data: {
      ...rest, alias, domainId, userId: auth.user.id, name: rest.name ?? alias,
      blocks: blocks.length ? { create: blocks.map((b) => ({ type: b.type ?? "link", title: b.title ?? null, url: b.url ?? null, content: b.content ?? "{}", thumbnail: b.thumbnail ?? null, order: b.order ?? 0, enabled: b.enabled ?? true })) } : undefined,
    },
    include: { domain: true, blocks: { orderBy: { order: "asc" } }, _count: { select: { blocks: true } } },
  });
  return apiOk({ data: serializeBio(created) }, 201);
});
