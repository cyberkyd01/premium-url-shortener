import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { renderQrSvg, renderQrPng, renderQrPdf, inlineLogo, normalizeQrStyle, qrPayload } from "@/lib/qr";
import { shortUrl } from "@/lib/links";
import { bioUrl } from "@/lib/bio-widgets";
import { appUrl, json, slugify } from "@/lib/utils";

/** GET /api/qr/:id/download?format=svg|png|pdf&size= — downloads an owned QR code. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: 1, message: "Unauthorized" }, { status: 401 });
  const qr = await db.qrCode.findFirst({ where: { id, ...(ws.isAdmin ? {} : { userId: ws.ownerId }) }, include: { link: { include: { domain: true } }, bioPage: { include: { domain: true } } } });
  if (!qr) return NextResponse.json({ error: 1, message: "Not found" }, { status: 404 });
  const format = (req.nextUrl.searchParams.get("format") ?? "png").toLowerCase();
  const size = parseInt(req.nextUrl.searchParams.get("size") ?? "1000", 10) || 1000;
  const style = normalizeQrStyle(json(qr.style, {}));
  style.size = Math.min(2000, Math.max(128, size));
  const data = qrPayload(qr, { shortUrl: qr.link ? shortUrl(qr.link) : null, bioUrl: qr.bioPage ? bioUrl(qr.bioPage, appUrl("/")) : null });
  const name = slugify(qr.name) || "qr-code";
  if (format === "svg") {
    return new NextResponse(renderQrSvg(data, style), { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${name}.svg"` } });
  }
  style.logo = await inlineLogo(style.logo);
  const svg = renderQrSvg(data, style);
  if (format === "pdf") {
    const pdf = await renderQrPdf(svg);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  }
  const png = await renderQrPng(svg);
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"` } });
}
