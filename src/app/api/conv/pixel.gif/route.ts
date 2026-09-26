import { NextRequest, NextResponse } from "next/server";
import { parseVisitor } from "@/lib/geo";
import { rateLimit } from "@/lib/api-auth";
import { asNumber } from "@/lib/api-helpers";
import { recordConversion } from "@/lib/conversions";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function gif() {
  return new NextResponse(GIF, { status: 200, headers: { "content-type": "image/gif", "content-length": String(GIF.length), "cache-control": "no-store, no-cache, must-revalidate, max-age=0", pragma: "no-cache", "access-control-allow-origin": "*" } });
}

/** GET /api/conv/pixel.gif?alias=&goal=&value= — tracking pixel for emails / no-JS pages. Always returns the GIF. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const v = parseVisitor(req.headers);
  if (rateLimit("convpx:" + v.ip, 120).ok && (q.get("alias") || q.get("linkId"))) {
    await recordConversion({ alias: q.get("alias"), linkId: q.get("linkId"), goal: q.get("goal") || "pixel", value: asNumber(q.get("value")), clickId: q.get("clickId") }, v).catch(() => null);
  }
  return gif();
}
