import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/api-auth";
import { clientIp } from "@/lib/geo";
import { bioUnlockToken } from "@/components/bio/bio-renderer";

/** POST { pageId, password } — verifies a bio page password and sets the unlock cookie. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit("bio-gate:" + ip, 10).ok) return NextResponse.json({ ok: false, message: "Too many attempts" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { pageId?: unknown; password?: unknown };
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const password = typeof body.password === "string" ? body.password : "";
  const page = pageId ? await db.bioPage.findUnique({ where: { id: pageId }, select: { id: true, password: true } }) : null;
  if (!page || !page.password || page.password !== password) return NextResponse.json({ ok: false }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("bio_unlock_" + page.id, bioUnlockToken(page), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
}
