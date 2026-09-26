import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asBool, asString, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializeChannel } from "@/lib/api-serializers";
import { loadChannel } from "@/lib/api-resources";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "channels.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializeChannel(await loadChannel(id, auth.user.id, auth.isAdmin)) });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "channels.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadChannel(id, auth.user.id, auth.isAdmin);
  const body = await readBody(req);
  const data: { name?: string; color?: string; starred?: boolean } = {};
  const name = asString(body.name)?.trim();
  if (name) data.name = name.slice(0, 100);
  const color = asString(body.color);
  if (color) data.color = color;
  const starred = asBool(body.starred);
  if (starred !== undefined) data.starred = starred;
  const updated = await db.channel.update({ where: { id: c.id }, data, include: { _count: { select: { links: true, bioPages: true, qrCodes: true } } } });
  return apiOk({ data: serializeChannel(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "channels.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const c = await loadChannel(id, auth.user.id, auth.isAdmin);
  await db.channel.delete({ where: { id: c.id } });
  return apiOk({ data: { id: c.id }, message: "Channel deleted" });
});
