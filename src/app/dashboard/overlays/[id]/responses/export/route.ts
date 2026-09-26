import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /dashboard/overlays/[id]/responses/export — CSV download of all responses. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const overlay = await db.overlay.findFirst({ where: { id, userId: ws.ownerId } });
  if (!overlay) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = await db.overlayResponse.findMany({ where: { overlayId: id }, orderBy: { createdAt: "desc" } });
  const parsed = rows.map((r) => ({ r, d: json<Record<string, unknown>>(r.data, {}) }));
  const keys = [...new Set(parsed.flatMap(({ d }) => Object.keys(d)))];
  const header = [...keys, "ip", "date"];
  const lines = [header.map(csvCell).join(",")];
  for (const { r, d } of parsed) lines.push([...keys.map((k) => csvCell(d[k])), csvCell(r.ip), csvCell(r.createdAt.toISOString())].join(","));
  const filename = `${overlay.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "overlay"}-responses.csv`;
  return new NextResponse("﻿" + lines.join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` } });
}
