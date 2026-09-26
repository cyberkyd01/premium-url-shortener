import { NextRequest, NextResponse } from "next/server";
import { renderQrSvg, renderQrPng, inlineLogo, decodeQrStyle } from "@/lib/qr";
import { rateLimit } from "@/lib/api-auth";
import { clientIp } from "@/lib/geo";

/** GET /api/qr/render?data=<string>&format=svg|png&style=<base64 json> — public stateless QR renderer used for previews and thumbnails. */
export async function GET(req: NextRequest) {
  if (!rateLimit("qr-render:" + clientIp(req.headers), 300).ok) return NextResponse.json({ error: 1, message: "Rate limit exceeded" }, { status: 429 });
  const sp = req.nextUrl.searchParams;
  const data = (sp.get("data") ?? "").slice(0, 2000);
  if (!data) return NextResponse.json({ error: 1, message: "Missing data" }, { status: 400 });
  const format = sp.get("format") === "png" ? "png" : "svg";
  const style = decodeQrStyle(sp.get("style"));
  const size = parseInt(sp.get("size") ?? "", 10);
  if (size) style.size = Math.min(2000, Math.max(64, size));
  try {
    if (format === "png") {
      style.logo = await inlineLogo(style.logo);
      const png = await renderQrPng(renderQrSvg(data, style));
      return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
    }
    const svg = renderQrSvg(data, style);
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ error: 1, message: e instanceof Error ? e.message : "Render failed" }, { status: 400 });
  }
}
