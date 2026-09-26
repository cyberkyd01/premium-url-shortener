import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asArray, asString, corsPreflight, isRecord, readBody, ApiRequestError  } from "@/lib/api-helpers";
import { apiCreateLink } from "@/lib/api-links";
import { clientIp } from "@/lib/geo";
import type { SerializedLink } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

const MAX_BULK = 100;

export const OPTIONS = () => corsPreflight();

/** POST /api/v1/links/bulk  body: {urls: ["https://..", {url, custom, ...}], ...defaults} or a bare JSON array. */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "links.write");
  if ("error" in auth) return auth.error;
  const body = await readBody(req);
  const { urls: rawUrls, links: rawLinks, _array, ...defaults } = body;
  const items = asArray(rawUrls ?? rawLinks ?? _array);
  if (!items?.length) throw new ApiRequestError("Provide an array of urls");
  if (items.length > MAX_BULK) throw new ApiRequestError(`A maximum of ${MAX_BULK} links can be created per request`);
  const ip = clientIp(req.headers);
  const created: SerializedLink[] = [];
  const failed: { url: string; message: string }[] = [];
  for (const item of items) {
    const entry: Record<string, unknown> = isRecord(item) ? { ...defaults, ...item } : { ...defaults, url: asString(item) ?? "" };
    const url = asString(entry.url) ?? "";
    try {
      created.push(await apiCreateLink(entry, auth.user.id, auth.isAdmin, ip));
    } catch (e) {
      failed.push({ url, message: e instanceof Error ? e.message : "Failed" });
    }
  }
  return apiOk({ data: created, failed, created: created.length, total: items.length }, failed.length && !created.length ? 400 : 201);
});
