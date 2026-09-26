import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asStringArray, corsPreflight, readBody, ApiRequestError, type RouteCtx  } from "@/lib/api-helpers";
import { loadCampaign } from "@/lib/api-resources";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** POST /api/v1/campaigns/:id/links {links: [linkId...]} — attach links. DELETE with the same body detaches. */
export const POST = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const ids = asStringArray(body.links ?? body.ids ?? body._array);
  if (!ids?.length) throw new ApiRequestError("Provide an array of link ids in `links`");
  const r = await db.link.updateMany({ where: { id: { in: ids }, ...(auth.isAdmin ? {} : { userId: auth.user.id }) }, data: { campaignId: c.id } });
  return apiOk({ data: { campaignId: c.id, added: r.count } });
});

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "campaigns.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadCampaign(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const ids = asStringArray(body.links ?? body.ids ?? body._array);
  if (!ids?.length) throw new ApiRequestError("Provide an array of link ids in `links`");
  const r = await db.link.updateMany({ where: { id: { in: ids }, campaignId: c.id }, data: { campaignId: null } });
  return apiOk({ data: { campaignId: c.id, removed: r.count } });
});
