import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializeBioBlock } from "@/lib/api-serializers";
import { loadBio, loadBioBlock } from "@/lib/api-resources";
import { blockFromBody } from "@/lib/api-bio";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string; blockId: string }>) => {
  const auth = await authenticate(req, "bio.read");
  if ("error" in auth) return auth.error;
  const { id, blockId } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  return apiOk({ data: serializeBioBlock(await loadBioBlock(page.id, blockId)) });
});

export const PUT = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string; blockId: string }>) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const { id, blockId } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  const block = await loadBioBlock(page.id, blockId);
  const data = blockFromBody(await readBody(req), true);
  const updated = await db.bioBlock.update({ where: { id: block.id }, data });
  return apiOk({ data: serializeBioBlock(updated) });
});

export const PATCH = PUT;

export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string; blockId: string }>) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const { id, blockId } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  const block = await loadBioBlock(page.id, blockId);
  await db.bioBlock.delete({ where: { id: block.id } });
  return apiOk({ data: { id: block.id }, message: "Block deleted" });
});
