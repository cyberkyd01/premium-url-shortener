import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { submitReport } from "@/lib/public-forms";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 1, message: "Invalid JSON body" }, { status: 400 }); }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const user = await currentUser();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
  const r = await submitReport({ target: str("url") || str("alias"), reason: str("reason"), details: str("details"), email: str("email"), userId: user?.id ?? null, ip });
  return r.ok ? NextResponse.json({ error: 0, message: r.message }) : NextResponse.json({ error: 1, message: r.error }, { status: 400 });
}
