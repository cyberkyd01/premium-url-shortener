import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { verifyDomain } from "@/lib/domain-verify";
import { revalidatePath } from "next/cache";
import { cloudflareConfig, provisionHostname } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

/** GET /api/domains/verify?id=<domainId> — checks DNS / HTTP and activates the domain when it points here. */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!can(ws, "domains", "edit")) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const domain = await db.domain.findFirst({ where: { id, userId: ws.ownerId } });
  if (!domain) return NextResponse.json({ ok: false, error: "Domain not found" }, { status: 404 });
  if (domain.status === 1) return NextResponse.json({ ok: true, status: 1, message: "Domain is already active" });
  const result = await verifyDomain(domain.domain);
  if (result.ok) {
    await db.domain.update({ where: { id }, data: { status: 1 } });
    if ((await cloudflareConfig()).enabled) await provisionHostname(domain);
    revalidatePath("/dashboard/domains");
  }
  return NextResponse.json({ ok: result.ok, status: result.ok ? 1 : 0, method: result.method ?? null, message: result.message });
}
