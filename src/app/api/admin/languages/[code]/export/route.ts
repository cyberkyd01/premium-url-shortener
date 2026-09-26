import { NextResponse } from "next/server";
import { apiAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import en from "@/locales/en.json";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await apiAdmin("languages.manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { code } = await params;
  const lang = await db.language.findUnique({ where: { code }, include: { strings: true } });
  if (!lang) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const strings: Record<string, string> = code === "en" ? { ...(en as Record<string, string>) } : {};
  for (const s of lang.strings) strings[s.key] = s.value;
  const pack = { code: lang.code, name: lang.name, flag: lang.flag, rtl: lang.rtl, exportedAt: new Date().toISOString(), strings };
  return new NextResponse(JSON.stringify(pack, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="lang-${code}.json"` } });
}
