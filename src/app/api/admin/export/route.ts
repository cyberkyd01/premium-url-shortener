import { NextResponse, type NextRequest } from "next/server";
import { apiAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { TABLE_NAMES, type TableName } from "@/lib/admin/system";

const SENSITIVE = new Set(["password", "twoFactorSecret", "resetToken", "verificationToken", "emailOtp", "apiKey", "twilioToken"]);

export async function GET(req: NextRequest) {
  if (!(await apiAdmin("tools.manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const themeSlug = sp.get("theme");
  if (themeSlug) {
    const t = await db.theme.findUnique({ where: { slug: themeSlug } });
    if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pack = { slug: t.slug, name: t.name, parent: t.parent, config: JSON.parse(t.config || "{}") as unknown, customCss: t.customCss, customJs: t.customJs, overrides: JSON.parse(t.overrides || "{}") as unknown };
    return new NextResponse(JSON.stringify(pack, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="theme-${t.slug}.json"` } });
  }
  const tables = sp.getAll("tables").filter((t): t is TableName => (TABLE_NAMES as readonly string[]).includes(t));
  if (!tables.length) return NextResponse.json({ error: "No tables selected" }, { status: 400 });
  const out: Record<string, unknown[]> = {};
  for (const t of tables) {
    const rows = await (db[t] as unknown as { findMany: (a: { take: number }) => Promise<Record<string, unknown>[]> }).findMany({ take: 10000 });
    out[t] = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SENSITIVE.has(k))));
  }
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), tables: out }, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="export-${new Date().toISOString().slice(0, 10)}.json"` } });
}
