import { NextResponse, type NextRequest } from "next/server";
import { extendMailbox, mailboxByToken, TempMailError } from "@/lib/tempmail";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ token: string }> };

/** POST /api/tempmail/{token}/extend — extends the mailbox lifetime by one TTL (max 7 days). */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const m = await mailboxByToken(token);
  if (!m) return NextResponse.json({ error: "Inbox not found or expired" }, { status: 404 });
  try {
    const updated = await extendMailbox(m.id, { token });
    return NextResponse.json({ ok: true, expiresAt: updated.expiresAt.toISOString() });
  } catch (e) {
    if (e instanceof TempMailError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
