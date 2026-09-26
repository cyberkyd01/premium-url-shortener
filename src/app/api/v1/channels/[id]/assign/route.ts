import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asStringArray, corsPreflight, readBody, ApiRequestError, type RouteCtx  } from "@/lib/api-helpers";
import { loadChannel } from "@/lib/api-resources";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** POST /api/v1/channels/:id/assign {links: [], qr: [], bio: []} — assigns resources to the channel. */
export const POST = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "channels.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadChannel(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const links = asStringArray(body.links) ?? [];
  const qr = asStringArray(body.qr ?? body.qrCodes) ?? [];
  const bio = asStringArray(body.bio ?? body.bioPages) ?? [];
  if (!links.length && !qr.length && !bio.length) throw new ApiRequestError("Provide `links`, `qr` and/or `bio` id arrays");
  const owner = auth.isAdmin ? {} : { userId: auth.user.id };
  const [l, q, b] = await Promise.all([
    links.length ? db.link.updateMany({ where: { id: { in: links }, ...owner }, data: { channelId: c.id } }) : { count: 0 },
    qr.length ? db.qrCode.updateMany({ where: { id: { in: qr }, ...owner }, data: { channelId: c.id } }) : { count: 0 },
    bio.length ? db.bioPage.updateMany({ where: { id: { in: bio }, ...owner }, data: { channelId: c.id } }) : { count: 0 },
  ]);
  return apiOk({ data: { channelId: c.id, assigned: { links: l.count, qr: q.count, bio: b.count } } });
});
