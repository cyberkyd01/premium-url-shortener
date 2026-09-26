import { NextRequest, NextResponse } from "next/server";
import { parseVisitor } from "@/lib/geo";
import { rateLimit } from "@/lib/api-auth";
import { asNumber, asRecord, asString, corsPreflight, readBody, withCors } from "@/lib/api-helpers";
import { ConversionError, recordConversion } from "@/lib/conversions";

export const dynamic = "force-dynamic";

/**
 * POST /api/conv — records a conversion. CORS open so the embed script can call it from any site.
 * Body (JSON or form): { alias | linkId, goal?, value?, clickId?, meta? }
 */
export async function POST(req: NextRequest) {
  const v = parseVisitor(req.headers);
  const rl = rateLimit("conv:" + v.ip, 120);
  if (!rl.ok) return withCors(NextResponse.json({ error: 1, message: "Too many requests" }, { status: 429 }));
  const body = await readBody(req);
  try {
    const r = await recordConversion({ alias: asString(body.alias), linkId: asString(body.linkId), goal: asString(body.goal), value: asNumber(body.value), clickId: asString(body.clickId), meta: asRecord(body.meta) }, v);
    return withCors(NextResponse.json({ error: 0, id: r.id, goal: r.goal, value: r.value, attributed: !!r.clickId, duplicate: r.duplicate }));
  } catch (e) {
    if (e instanceof ConversionError) return withCors(NextResponse.json({ error: 1, message: e.message }, { status: e.status }));
    console.error("[conv]", e);
    return withCors(NextResponse.json({ error: 1, message: "Could not record conversion" }, { status: 500 }));
  }
}

/** GET /api/conv?alias=&goal=&value= — same as POST for `navigator.sendBeacon`-less environments. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const v = parseVisitor(req.headers);
  const rl = rateLimit("conv:" + v.ip, 120);
  if (!rl.ok) return withCors(NextResponse.json({ error: 1, message: "Too many requests" }, { status: 429 }));
  try {
    const r = await recordConversion({ alias: q.get("alias"), linkId: q.get("linkId"), goal: q.get("goal"), value: asNumber(q.get("value")), clickId: q.get("clickId") }, v);
    return withCors(NextResponse.json({ error: 0, id: r.id, goal: r.goal, value: r.value, attributed: !!r.clickId, duplicate: r.duplicate }));
  } catch (e) {
    if (e instanceof ConversionError) return withCors(NextResponse.json({ error: 1, message: e.message }, { status: e.status }));
    return withCors(NextResponse.json({ error: 1, message: "Could not record conversion" }, { status: 500 }));
  }
}

export function OPTIONS() { return corsPreflight(); }
