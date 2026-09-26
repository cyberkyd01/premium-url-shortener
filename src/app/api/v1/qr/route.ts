import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asRecord, asString, corsPreflight, paginate, paginated, readBody  } from "@/lib/api-helpers";
import { serializeQr } from "@/lib/api-serializers";
import { buildQrPayload, styleJson, uniqueQrAlias, wantsDynamic } from "@/lib/api-qr";
import { withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/qr?search=&type=&channel=&page=&limit= */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "qr.read");
  if ("error" in auth) return auth.error;
  const q = req.nextUrl.searchParams;
  const p = paginate(req);
  const where: Prisma.QrCodeWhereInput = { userId: auth.user.id };
  if (q.get("search")) where.name = { contains: q.get("search") ?? "" };
  if (q.get("type")) where.type = q.get("type") ?? undefined;
  if (q.get("channel")) where.channelId = q.get("channel") ?? undefined;
  const [rows, total] = await Promise.all([
    db.qrCode.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { link: { include: { domain: true } } } }),
    db.qrCode.count({ where }),
  ]);
  return paginated(rows.map(serializeQr), total, p);
});

/** POST /api/v1/qr {type, data{}, name, style{}, dynamic} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "qr.write");
  if ("error" in auth) return auth.error;
  const s = await getSettings();
  if (s["qr.enabled"] !== "1" && !auth.isAdmin) return apiError("QR codes are disabled", 403);
  const total = await withinLimit(auth.user.id, "limitQrCodes");
  if (!total.ok) return apiError(`You have reached your plan limit of ${total.limit} QR codes`, 402);
  const monthly = await withinLimit(auth.user.id, "limitQrMonthly");
  if (!monthly.ok) return apiError(`You have reached your monthly limit of ${monthly.limit} QR codes`, 402);
  const body = await readBody(req);
  const payload = await buildQrPayload(body, auth.user.id, auth.isAdmin, auth.features);
  const isDynamic = wantsDynamic(body, auth.isAdmin || auth.features.dynamicQr, payload.type);
  if (isDynamic && !auth.isAdmin && !auth.features.dynamicQr) return apiError("Dynamic QR codes are not available on your plan", 402);
  const style = asRecord(body.style) ?? {};
  if (Object.keys(style).length && !auth.isAdmin && !auth.features.advancedQr) return apiError("Advanced QR styling is not available on your plan", 402);
  let channelId: string | null = null;
  const channel = asString(body.channel ?? body.channelId);
  if (channel) {
    const c = await db.channel.findFirst({ where: { id: channel, userId: auth.user.id } });
    if (!c) return apiError("Channel not found", 404);
    channelId = c.id;
  }
  const qr = await db.qrCode.create({
    data: {
      name: (asString(body.name)?.trim() || payload.content).slice(0, 100), userId: auth.user.id, type: payload.type, data: payload.data, isDynamic,
      linkId: payload.linkId, bioPageId: payload.bioPageId, alias: isDynamic ? await uniqueQrAlias() : null, style: styleJson(style), channelId,
    },
    include: { link: { include: { domain: true } } },
  });
  return apiOk({ data: serializeQr(qr) }, 201);
});
