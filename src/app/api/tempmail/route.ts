import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/api-auth";
import { createMailbox, tempMailConfig, TempMailError } from "@/lib/tempmail";

export const dynamic = "force-dynamic";

/** GET /api/tempmail — public config (domains, guest access). POST — create a mailbox (guest or logged-in). */
export async function GET() {
  const cfg = await tempMailConfig();
  return NextResponse.json({ enabled: cfg.enabled, domains: cfg.domains, guests: cfg.guests, ttlMinutes: cfg.ttlMinutes });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`tempmail:create:${ip}`, 10).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const user = await currentUser();
  let body: Record<string, unknown> = {};
  try { const parsed: unknown = await req.json(); if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>; } catch { /* empty */ }
  try {
    const m = await createMailbox(user?.id ?? null, { domain: typeof body.domain === "string" ? body.domain : null, local: typeof body.local === "string" ? body.local : null });
    return NextResponse.json({ ok: true, mailbox: { id: m.id, address: m.address, token: m.token, expiresAt: m.expiresAt.toISOString() } });
  } catch (e) {
    if (e instanceof TempMailError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
