import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asRecord, asString, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializeQr } from "@/lib/api-serializers";
import { loadQr } from "@/lib/api-resources";
import { buildQrPayload, styleJson, uniqueQrAlias, wantsDynamic } from "@/lib/api-qr";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "qr.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializeQr(await loadQr(id, auth.user.id, auth.isAdmin)) });
});

/** PUT /api/v1/qr/:id {name?, data?, type?, style?, dynamic?, channel?} */
export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "qr.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const qr = await loadQr(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const data: Prisma.QrCodeUpdateInput = {};
  const name = asString(body.name)?.trim();
  if (name) data.name = name.slice(0, 100);
  if (body.data !== undefined || body.content !== undefined || body.url !== undefined || body.text !== undefined || (body.type !== undefined && body.type !== qr.type)) {
    const payload = await buildQrPayload(body, auth.user.id, auth.isAdmin, auth.features, qr.type);
    data.type = payload.type; data.data = payload.data;
    data.link = payload.linkId ? { connect: { id: payload.linkId } } : { disconnect: true };
    data.bioPage = payload.bioPageId ? { connect: { id: payload.bioPageId } } : { disconnect: true };
  }
  const style = asRecord(body.style);
  if (style) {
    if (!auth.isAdmin && !auth.features.advancedQr && Object.keys(style).length) return apiError("Advanced QR styling is not available on your plan", 402);
    data.style = styleJson(style);
  }
  const isDynamic = wantsDynamic(body, qr.isDynamic, asString(body.type) ?? qr.type);
  if (isDynamic !== qr.isDynamic) {
    if (isDynamic && !auth.isAdmin && !auth.features.dynamicQr) return apiError("Dynamic QR codes are not available on your plan", 402);
    data.isDynamic = isDynamic;
    data.alias = isDynamic ? qr.alias ?? (await uniqueQrAlias()) : null;
  }
  if (body.channel !== undefined || body.channelId !== undefined) {
    const channel = asString(body.channel ?? body.channelId);
    if (channel) {
      const c = await db.channel.findFirst({ where: { id: channel, userId: auth.user.id } });
      if (!c) return apiError("Channel not found", 404);
      data.channel = { connect: { id: c.id } };
    } else data.channel = { disconnect: true };
  }
  const updated = await db.qrCode.update({ where: { id: qr.id }, data, include: { link: { include: { domain: true } } } });
  return apiOk({ data: serializeQr(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "qr.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const qr = await loadQr(id, auth.user.id, auth.isAdmin);
  await db.qrCode.delete({ where: { id: qr.id } });
  return apiOk({ data: { id: qr.id }, message: "QR code deleted" });
});
