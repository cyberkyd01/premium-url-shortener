import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, corsPreflight, paginate, paginated, readBody, requireString, ApiRequestError  } from "@/lib/api-helpers";
import { serializePixel } from "@/lib/api-serializers";
import { withinLimit } from "@/lib/plan";

export const dynamic = "force-dynamic";

const PIXEL_PROVIDERS = ["facebook", "twitter", "bing", "google-ads", "gtm", "ga", "snapchat", "reddit", "quora", "pinterest", "tiktok", "linkedin", "adroll", "hotjar", "clarity", "matomo", "custom"];

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "pixels.read");
  if ("error" in auth) return auth.error;
  const p = paginate(req);
  const where = { userId: auth.user.id };
  const [rows, total] = await Promise.all([
    db.pixel.findMany({ where, orderBy: { createdAt: "desc" }, skip: p.skip, take: p.limit, include: { _count: { select: { links: true } } } }),
    db.pixel.count({ where }),
  ]);
  return paginated(rows.map(serializePixel), total, p);
});

/** POST /api/v1/pixels {name, provider, pixelId} */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "pixels.write");
  if ("error" in auth) return auth.error;
  if (!auth.isAdmin && !auth.features.pixels) return apiError("Pixels are not available on your plan", 402);
  const limit = await withinLimit(auth.user.id, "limitPixels");
  if (!limit.ok) return apiError(`You have reached your plan limit of ${limit.limit} pixels`, 402);
  const body = await readBody(req);
  const provider = requireString(body.provider ?? body.type, "provider").toLowerCase();
  if (!PIXEL_PROVIDERS.includes(provider)) throw new ApiRequestError("Invalid provider. Use one of: " + PIXEL_PROVIDERS.join(", "));
  const pixel = await db.pixel.create({
    data: { name: requireString(body.name, "name").slice(0, 100), provider, pixelId: requireString(body.pixelId ?? body.pixel_id ?? body.tag, "pixelId").slice(0, 500), userId: auth.user.id },
    include: { _count: { select: { links: true } } },
  });
  return apiOk({ data: serializePixel(pixel) }, 201);
});
