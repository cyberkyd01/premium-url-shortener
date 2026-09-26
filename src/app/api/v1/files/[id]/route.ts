import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, type RouteCtx  } from "@/lib/api-helpers";
import { serializeFile } from "@/lib/api-serializers";
import { loadFile } from "@/lib/api-resources";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "files.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  return apiOk({ data: serializeFile(await loadFile(id, auth.user.id, auth.isAdmin)) });
});

/** DELETE /api/v1/files/:id — removes the record, the local file (when stored locally) and frees storage quota. */
export const DELETE = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "files.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const f = await loadFile(id, auth.user.id, auth.isAdmin);
  await db.$transaction([
    db.hostedFile.delete({ where: { id: f.id } }),
    db.user.update({ where: { id: f.userId }, data: { storageUsed: { decrement: f.size } } }),
  ]);
  if (!/^https?:\/\//.test(f.path)) {
    const rel = f.path.replace(/^\/?(public\/)?(uploads\/)?/, "");
    const abs = path.join(process.cwd(), "public", "uploads", rel);
    if (abs.startsWith(path.join(process.cwd(), "public", "uploads"))) await fs.unlink(abs).catch(() => {});
  }
  return apiOk({ data: { id: f.id }, message: "File deleted" });
});
