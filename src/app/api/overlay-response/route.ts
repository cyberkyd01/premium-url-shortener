import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/geo";
import { rateLimit } from "@/lib/api-auth";

/** Stores a visitor response from an overlay widget (poll vote, newsletter signup, contact form, CTA click). */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit("overlay:" + ip, 30).ok) return NextResponse.json({ error: 1, message: "Too many requests" }, { status: 429 });
  let body: { overlayId?: unknown; data?: unknown };
  try { body = (await req.json()) as { overlayId?: unknown; data?: unknown }; } catch { return NextResponse.json({ error: 1, message: "Invalid JSON" }, { status: 400 }); }
  const overlayId = typeof body.overlayId === "string" ? body.overlayId : "";
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  if (!overlayId) return NextResponse.json({ error: 1, message: "overlayId required" }, { status: 400 });
  const overlay = await db.overlay.findUnique({ where: { id: overlayId }, select: { id: true } });
  if (!overlay) return NextResponse.json({ error: 1, message: "Overlay not found" }, { status: 404 });
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(data).slice(0, 20)) clean[k.slice(0, 50)] = String(v).slice(0, 2000);
  await db.overlayResponse.create({ data: { overlayId, data: JSON.stringify(clean), ip } });
  return NextResponse.json({ error: 0 });
}
