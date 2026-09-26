import { NextResponse } from "next/server";
import { submitContact } from "@/lib/public-forms";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 1, message: "Invalid JSON body" }, { status: 400 }); }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
  const r = await submitContact({ name: str("name"), email: str("email"), subject: str("subject"), message: str("message"), captcha: str("captcha"), honeypot: str("website"), ip });
  return r.ok ? NextResponse.json({ error: 0, message: r.message }) : NextResponse.json({ error: 1, message: r.error }, { status: 400 });
}
