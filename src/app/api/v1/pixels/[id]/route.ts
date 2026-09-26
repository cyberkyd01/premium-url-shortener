import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asString, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializePixel } from "@/lib/api-serializers";
import { loadPixel } from "@/lib/api-resources";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "pixels.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializePixel(await loadPixel(id, auth.user.id, auth.isAdmin)) });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "pixels.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const pixel = await loadPixel(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const data: { name?: string; pixelId?: string; provider?: string } = {};
  const name = asString(body.name)?.trim();
  if (name) data.name = name.slice(0, 100);
  const pid = asString(body.pixelId ?? body.pixel_id ?? body.tag)?.trim();
  if (pid) data.pixelId = pid.slice(0, 500);
  const provider = asString(body.provider)?.trim().toLowerCase();
  if (provider) data.provider = provider;
  const updated = await db.pixel.update({ where: { id: pixel.id }, data, include: { _count: { select: { links: true } } } });
  return apiOk({ data: serializePixel(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "pixels.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const pixel = await loadPixel(id, auth.user.id, auth.isAdmin);
  await db.pixel.delete({ where: { id: pixel.id } });
  return apiOk({ data: { id: pixel.id }, message: "Pixel deleted" });
});
