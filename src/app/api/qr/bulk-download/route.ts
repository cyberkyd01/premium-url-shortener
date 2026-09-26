import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { renderQrSvg, renderQrPng, inlineLogo, normalizeQrStyle, qrPayload } from "@/lib/qr";
import { shortUrl } from "@/lib/links";
import { bioUrl } from "@/lib/bio-widgets";
import { appUrl, json, slugify } from "@/lib/utils";

const MAX_IDS = 500;

/** GET /api/qr/bulk-download?ids=a,b,c&format=png|svg&size= — zips the selected QR codes (owner or admin). */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (!ids.length) return NextResponse.json({ error: 1, message: "No QR codes selected" }, { status: 400 });
  const format = (req.nextUrl.searchParams.get("format") ?? "png").toLowerCase() === "svg" ? "svg" : "png";
  const size = Math.min(2000, Math.max(128, parseInt(req.nextUrl.searchParams.get("size") ?? "1000", 10) || 1000));
  const rows = await db.qrCode.findMany({ where: { id: { in: ids }, ...(ws.isAdmin ? {} : { userId: ws.ownerId }) }, include: { link: { include: { domain: true } }, bioPage: { include: { domain: true } } } });
  if (!rows.length) return NextResponse.json({ error: 1, message: "Not found" }, { status: 404 });

  const zip = new JSZip();
  const used = new Map<string, number>();
  const base = appUrl("/");
  for (const qr of rows) {
    const style = normalizeQrStyle(json(qr.style, {}));
    style.size = size;
    const data = qrPayload(qr, { shortUrl: qr.link ? shortUrl(qr.link) : null, bioUrl: qr.bioPage ? bioUrl(qr.bioPage, base) : null });
    let name = slugify(qr.name) || "qr-code";
    const n = (used.get(name) ?? 0) + 1;
    used.set(name, n);
    if (n > 1) name = `${name}-${n}`;
    if (format === "svg") {
      zip.file(`${name}.svg`, renderQrSvg(data, style));
    } else {
      style.logo = await inlineLogo(style.logo);
      zip.file(`${name}.png`, await renderQrPng(renderQrSvg(data, style)));
    }
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: format === "svg" ? "DEFLATE" : "STORE", compressionOptions: { level: 6 } });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="qr-codes.zip"`, "Content-Length": String(buffer.length), "Cache-Control": "no-store" },
  });
}
