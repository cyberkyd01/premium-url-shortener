import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { LINK_INCLUDE, loadLink } from "@/lib/api-links";
import { serializeLink } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** POST /api/v1/links/:id/archive  body: {archived?: boolean} (default true) */
export const POST = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "links.write");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin && !auth.features.archive) return apiError("Archiving is not available on your plan", 402);
  const { id } = await params;
  const link = await loadLink(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const archived = asBool(body.archived) ?? true;
  const updated = await db.link.update({ where: { id: link.id }, data: { isArchived: archived }, include: LINK_INCLUDE });
  return apiOk({ data: serializeLink(updated), message: archived ? "Link archived" : "Link restored" });
});
