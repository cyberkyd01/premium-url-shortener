import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, asString, corsPreflight, paginate, paginated, readBody, requireString  } from "@/lib/api-helpers";
import { serializeChannel } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "channels.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const where = { userId: auth.user.id };
  const [rows, total] = await Promise.all([
    db.channel.findMany({ where, orderBy: [{ starred: "desc" }, { createdAt: "desc" }], skip: p.skip, take: p.limit, include: { _count: { select: { links: true, bioPages: true, qrCodes: true } } } }),
    db.channel.count({ where }),
  ]);
  return paginated(rows.map(serializeChannel), total, p);
});

/** POST /api/v1/channels {name, color?, starred?} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "channels.write");
  if ("error" in auth) return auth.error;
  const limit = auth.plan?.limitChannels ?? -1;
  if (!auth.isAdmin && limit >= 0) {
    const used = await db.channel.count({ where: { userId: auth.user.id } });
    if (used >= limit) return apiError(`You have reached your plan limit of ${limit} channels`, 402);
  }
  const body = await readBody(req);
  const c = await db.channel.create({
    data: { name: requireString(body.name, "name").slice(0, 100), color: asString(body.color) || "#6366f1", starred: asBool(body.starred) ?? false, userId: auth.user.id },
    include: { _count: { select: { links: true, bioPages: true, qrCodes: true } } },
  });
  return apiOk({ data: serializeChannel(c) }, 201);
});
