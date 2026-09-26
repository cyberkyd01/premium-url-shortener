import { NextResponse } from "next/server";
import { subscribeNewsletter } from "@/lib/public-forms";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 1, message: "Invalid JSON body" }, { status: 400 }); }
  const email = typeof body.email === "string" ? body.email : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 50) : "website";
  const r = await subscribeNewsletter(email, source);
  return r.ok ? NextResponse.json({ error: 0, message: r.message }) : NextResponse.json({ error: 1, message: r.error }, { status: 400 });
}
