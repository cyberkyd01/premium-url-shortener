import { NextResponse } from "next/server";
import { buildOpenApi } from "@/lib/openapi";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { CORS_HEADERS, corsPreflight } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

/** GET /api/v1/openapi.json → public OpenAPI 3.1 description of the developer API (CORS enabled, cached 5 minutes). */
export async function GET() {
  const s = await getSettings();
  const doc = buildOpenApi(appUrl(), s["site.name"] || "Premium URL Shortener");
  return NextResponse.json(doc, {
    headers: { ...CORS_HEADERS, "cache-control": "public, max-age=300", "content-disposition": 'inline; filename="openapi.json"' },
  });
}
