import { NextResponse, type NextRequest } from "next/server";
import { deleteMailbox, mailboxByToken } from "@/lib/tempmail";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

/** GET /api/tempmail/{token} — mailbox info. DELETE — remove the mailbox. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const m = await mailboxByToken(token);
  if (!m) return NextResponse.json({ error: "Inbox not found or expired" }, { status: 404 });
  return NextResponse.json({ id: m.id, address: m.address, expiresAt: m.expiresAt.toISOString() });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const m = await mailboxByToken(token);
  if (!m) return NextResponse.json({ error: "Inbox not found or expired" }, { status: 404 });
  await deleteMailbox(m.id, { token });
  return NextResponse.json({ ok: true });
}
