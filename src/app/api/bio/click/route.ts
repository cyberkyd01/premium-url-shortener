import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/api-auth";
import { clientIp } from "@/lib/geo";

/** POST { blockId } — increments the block click counter (sent via sendBeacon from public bio pages). */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit("bio-click:" + ip, 120).ok) return NextResponse.json({ ok: false }, { status: 429 });
  let blockId = "";
  try {
    const body = (await req.json()) as { blockId?: unknown };
    blockId = typeof body.blockId === "string" ? body.blockId : "";
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!blockId) return NextResponse.json({ ok: false }, { status: 400 });
  await db.bioBlock.updateMany({ where: { id: blockId }, data: { clicks: { increment: 1 } } });
  return NextResponse.json({ ok: true });
}
