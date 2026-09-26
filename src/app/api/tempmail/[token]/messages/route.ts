import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mailboxByToken, serializeEmail } from "@/lib/tempmail";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

/** GET /api/tempmail/{token}/messages — inbox listing (polled by the inbox UI). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const m = await mailboxByToken(token);
  if (!m) return NextResponse.json({ error: "Inbox not found or expired" }, { status: 404 });
  const emails = await db.tempEmail.findMany({ where: { mailboxId: m.id }, orderBy: { receivedAt: "desc" }, take: 200 });
  return NextResponse.json({ mailbox: { id: m.id, address: m.address, expiresAt: m.expiresAt.toISOString() }, messages: emails.map((e) => serializeEmail(e)) }, { headers: { "cache-control": "no-store" } });
}
