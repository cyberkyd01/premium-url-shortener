import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mailboxByToken, serializeEmail } from "@/lib/tempmail";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string; id: string }> };

async function load(ctx: Ctx) {
  const { token, id } = await ctx.params;
  const m = await mailboxByToken(token);
  if (!m) return null;
  const email = await db.tempEmail.findFirst({ where: { id, mailboxId: m.id } });
  return email ? { mailbox: m, email } : null;
}

/** GET — full message (sanitized HTML). PATCH — mark read/unread. DELETE — remove the message. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (!r) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (!r.email.read) await db.tempEmail.update({ where: { id: r.email.id }, data: { read: true } });
  return NextResponse.json({ message: serializeEmail({ ...r.email, read: true }, true) }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (!r) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  let read = true;
  try { const body: unknown = await req.json(); if (body && typeof body === "object" && "read" in body) read = !!(body as { read?: unknown }).read; } catch { /* default */ }
  await db.tempEmail.update({ where: { id: r.email.id }, data: { read } });
  return NextResponse.json({ ok: true, read });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const r = await load(ctx);
  if (!r) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  await db.tempEmail.delete({ where: { id: r.email.id } });
  return NextResponse.json({ ok: true });
}
