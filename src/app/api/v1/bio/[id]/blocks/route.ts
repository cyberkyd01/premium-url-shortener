import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asArray, corsPreflight, isRecord, readBody, type RouteCtx  } from "@/lib/api-helpers";
import { serializeBioBlock } from "@/lib/api-serializers";
import { loadBio } from "@/lib/api-resources";
import { blockFromBody } from "@/lib/api-bio";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.read");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin);
  return apiOk({ data: (page.blocks ?? []).map(serializeBioBlock) });
});

/** POST /api/v1/bio/:id/blocks {type, title?, url?, content?, order?} — or an array of blocks. */
export const POST = apiHandler(async (req: NextRequest, { params }: RouteCtx<{ id: string }>) => {
  const auth = await authenticate(req, "bio.write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const page = await loadBio(id, auth.user.id, auth.isAdmin, false);
  const body = await readBody(req);
  const items = (asArray(body._array ?? body.blocks) ?? [body]).filter(isRecord);
  const last = await db.bioBlock.aggregate({ where: { bioPageId: page.id }, _max: { order: true } });
  let order = (last._max.order ?? -1) + 1;
  const created = [];
  for (const item of items) {
    const b = blockFromBody(item);
    created.push(await db.bioBlock.create({ data: { bioPageId: page.id, type: b.type ?? "link", title: b.title ?? null, url: b.url ?? null, content: b.content ?? "{}", thumbnail: b.thumbnail ?? null, order: b.order ?? order++, enabled: b.enabled ?? true, scheduleStart: b.scheduleStart ?? null, scheduleEnd: b.scheduleEnd ?? null, countries: b.countries ?? "[]", languages: b.languages ?? "[]", sensitive: b.sensitive ?? false, gated: b.gated ?? null, animation: b.animation ?? null } }));
  }
  const data = created.map(serializeBioBlock);
  return apiOk(items.length === 1 && !body._array && !body.blocks ? { data: data[0] } : { data }, 201);
});
