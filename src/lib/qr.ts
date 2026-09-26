import QRCode from "qrcode";
import { promises as fs } from "fs";
import path from "path";
import type { QrCode } from "@prisma/client";
import { appUrl, escapeHtml, json } from "./utils";
import { encodeQrData, normalizeQrStyle, type QrStyle } from "./qr-types";

export * from "./qr-types";

// ------------------------------------------------------------------ Payload
/** The string a stored QR record encodes: dynamic codes point at the tracking alias, static ones embed the data. */
export function qrPayload(qr: Pick<QrCode, "type" | "data" | "isDynamic" | "alias">, extra: { shortUrl?: string | null; bioUrl?: string | null } = {}): string {
  if (qr.isDynamic && qr.alias) return appUrl("/" + qr.alias);
  const data = json<Record<string, string>>(qr.data, {});
  if ((qr.type === "link" || qr.type === "app") && extra.shortUrl) return extra.shortUrl;
  if (qr.type === "bio" && extra.bioUrl) return extra.bioUrl;
  return encodeQrData(qr.type, data);
}

/** The destination a dynamic QR alias should redirect to. */
export function qrTarget(qr: Pick<QrCode, "type" | "data">, extra: { shortUrl?: string | null; bioUrl?: string | null } = {}): string {
  const data = json<Record<string, string>>(qr.data, {});
  if ((qr.type === "link" || qr.type === "app") && extra.shortUrl) return extra.shortUrl;
  if (qr.type === "bio" && extra.bioUrl) return extra.bioUrl;
  return encodeQrData(qr.type, data);
}

// ------------------------------------------------------------------ SVG renderer
type Corners = [boolean, boolean, boolean, boolean]; // tl, tr, br, bl rounded?

function roundedRectPath(x: number, y: number, w: number, h: number, r: number, c: Corners) {
  const [tl, tr, br, bl] = c.map((v) => (v ? r : 0)) as [number, number, number, number];
  return [
    `M${x + tl},${y}`, `H${x + w - tr}`, tr ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : "", `V${y + h - br}`, br ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : "",
    `H${x + bl}`, bl ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : "", `V${y + tl}`, tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "", "Z",
  ].filter(Boolean).join(" ");
}

function modulePath(style: QrStyle["dots"], x: number, y: number, s: number, n: { t: boolean; r: boolean; b: boolean; l: boolean }) {
  const f = (v: number) => Math.round(v * 100) / 100;
  x = f(x); y = f(y);
  switch (style) {
    case "dots": return `<circle cx="${f(x + s / 2)}" cy="${f(y + s / 2)}" r="${f(s * 0.42)}"/>`;
    case "rounded": {
      const c: Corners = [!n.t && !n.l, !n.t && !n.r, !n.b && !n.r, !n.b && !n.l];
      return `<path d="${roundedRectPath(x, y, s, s, s * 0.35, c)}"/>`;
    }
    case "extra-rounded": {
      const c: Corners = [!n.t && !n.l, !n.t && !n.r, !n.b && !n.r, !n.b && !n.l];
      return `<path d="${roundedRectPath(x, y, s, s, s / 2, c)}"/>`;
    }
    case "classy": {
      const c: Corners = [!n.t && !n.l, false, !n.b && !n.r, false];
      return `<path d="${roundedRectPath(x, y, s, s, s / 2, c)}"/>`;
    }
    case "classy-rounded": {
      const c: Corners = [!n.t && !n.l, !n.t && !n.r, !n.b && !n.r, !n.b && !n.l];
      const r = s / 2;
      // primary diagonal fully rounded, other corners slightly
      const [tl, tr, br, bl] = [c[0] ? r : 0, c[1] ? r * 0.35 : 0, c[2] ? r : 0, c[3] ? r * 0.35 : 0];
      const d = [`M${x + tl},${y}`, `H${x + s - tr}`, tr ? `A${tr},${tr} 0 0 1 ${x + s},${y + tr}` : "", `V${y + s - br}`, br ? `A${br},${br} 0 0 1 ${x + s - br},${y + s}` : "", `H${x + bl}`, bl ? `A${bl},${bl} 0 0 1 ${x},${y + s - bl}` : "", `V${y + tl}`, tl ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : "", "Z"].filter(Boolean).join(" ");
      return `<path d="${d}"/>`;
    }
    default: return `<rect x="${x}" y="${y}" width="${s}" height="${s}"/>`;
  }
}

function finderPattern(style: QrStyle, x: number, y: number, cell: number) {
  const outer = 7 * cell, inner = 5 * cell, dot = 3 * cell;
  let ring = "";
  if (style.corners === "dot") {
    ring = `<path fill-rule="evenodd" d="M${x + outer / 2},${y} a${outer / 2},${outer / 2} 0 1 0 0.01,0 Z M${x + outer / 2},${y + cell} a${inner / 2},${inner / 2} 0 1 0 0.01,0 Z"/>`;
  } else if (style.corners === "extra-rounded") {
    const all: Corners = [true, true, true, true];
    ring = `<path fill-rule="evenodd" d="${roundedRectPath(x, y, outer, outer, outer * 0.3, all)} ${roundedRectPath(x + cell, y + cell, inner, inner, inner * 0.3, all)}"/>`;
  } else {
    ring = `<path fill-rule="evenodd" d="M${x},${y}h${outer}v${outer}h-${outer}Z M${x + cell},${y + cell}h${inner}v${inner}h-${inner}Z"/>`;
  }
  const dx = x + 2 * cell, dy = y + 2 * cell;
  const center = style.cornerDots === "dot"
    ? `<circle cx="${dx + dot / 2}" cy="${dy + dot / 2}" r="${dot / 2}"/>`
    : `<rect x="${dx}" y="${dy}" width="${dot}" height="${dot}" rx="${style.corners === "extra-rounded" ? dot * 0.2 : 0}"/>`;
  return ring + center;
}

/** Renders a styled QR code as an SVG string. Pure & synchronous (safe for the public render API). */
export function renderQrSvg(data: string, styleInput: Partial<QrStyle> | QrStyle = {}): string {
  const style = normalizeQrStyle(styleInput);
  const ec = style.logo ? "H" : style.ecLevel;
  const qr = QRCode.create(data || " ", { errorCorrectionLevel: ec });
  const n = qr.modules.size;
  const margin = style.margin;
  const total = n + margin * 2;
  const size = style.size;
  const cell = size / total;
  const off = margin * cell;
  const isDark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && qr.modules.get(r, c) === 1;
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  // logo clear zone (in modules)
  let clear: { from: number; to: number } | null = null;
  if (style.logo) {
    const logoModules = Math.ceil(n * style.logoSize) + 2;
    const start = Math.floor((n - logoModules) / 2);
    clear = { from: start, to: start + logoModules };
  }
  const inClear = (r: number, c: number) => !!clear && r >= clear.from && r < clear.to && c >= clear.from && c < clear.to;
  const dark = (r: number, c: number) => isDark(r, c) && !inFinder(r, c) && !inClear(r, c);

  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c)) continue;
      parts.push(modulePath(style.dots, off + c * cell, off + r * cell, cell, { t: dark(r - 1, c), r: dark(r, c + 1), b: dark(r + 1, c), l: dark(r, c - 1) }));
    }
  }
  parts.push(finderPattern(style, off, off, cell));
  parts.push(finderPattern(style, off + (n - 7) * cell, off, cell));
  parts.push(finderPattern(style, off, off + (n - 7) * cell, cell));

  const gid = "qg";
  let defs = "";
  let fill = style.color;
  if (style.gradient) {
    fill = `url(#${gid})`;
    // userSpaceOnUse so the gradient spans the whole code instead of repeating per module
    defs = style.gradient.type === "radial"
      ? `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${size / 2}" cy="${size / 2}" r="${size * 0.7}"><stop offset="0%" stop-color="${style.gradient.from}"/><stop offset="100%" stop-color="${style.gradient.to}"/></radialGradient>`
      : `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${size}" y2="0" gradientTransform="rotate(${style.gradient.rotation} ${size / 2} ${size / 2})"><stop offset="0%" stop-color="${style.gradient.from}"/><stop offset="100%" stop-color="${style.gradient.to}"/></linearGradient>`;
  }

  let logo = "";
  if (style.logo && clear) {
    const w = (clear.to - clear.from - 2) * cell;
    const x = off + (clear.from + 1) * cell;
    logo = `<image href="${escapeHtml(style.logo)}" x="${x}" y="${x}" width="${w}" height="${w}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  // Frame
  const pad = style.frame === "none" ? 0 : Math.round(size * 0.06);
  const label = style.frame === "label-bottom" || style.frame === "label-top" || style.frame === "badge";
  const labelH = label ? Math.round(size * 0.16) : 0;
  const W = size + pad * 2;
  const H = size + pad * 2 + labelH;
  const qrY = style.frame === "label-top" ? pad + labelH : pad;
  const fc = style.frameColor;
  const fontSize = Math.round(size * 0.075);
  const text = escapeHtml(style.frameText || "");
  let frame = "";
  if (style.frame === "simple") {
    frame = `<rect x="${pad / 2}" y="${pad / 2}" width="${W - pad}" height="${H - pad}" rx="${pad}" fill="none" stroke="${fc}" stroke-width="${Math.max(2, pad / 3)}"/>`;
  } else if (style.frame === "label-bottom") {
    frame = `<rect x="${pad / 2}" y="${pad / 2}" width="${W - pad}" height="${H - pad}" rx="${pad}" fill="none" stroke="${fc}" stroke-width="${Math.max(2, pad / 3)}"/>
<rect x="${pad / 2}" y="${H - labelH - pad / 2}" width="${W - pad}" height="${labelH}" rx="${pad}" fill="${fc}"/>
<rect x="${pad / 2}" y="${H - labelH - pad / 2}" width="${W - pad}" height="${pad}" fill="${fc}"/>
<text x="${W / 2}" y="${H - labelH / 2 - pad / 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${text}</text>`;
  } else if (style.frame === "label-top") {
    frame = `<rect x="${pad / 2}" y="${pad / 2}" width="${W - pad}" height="${H - pad}" rx="${pad}" fill="none" stroke="${fc}" stroke-width="${Math.max(2, pad / 3)}"/>
<rect x="${pad / 2}" y="${pad / 2}" width="${W - pad}" height="${labelH}" rx="${pad}" fill="${fc}"/>
<rect x="${pad / 2}" y="${labelH - pad / 2}" width="${W - pad}" height="${pad}" fill="${fc}"/>
<text x="${W / 2}" y="${labelH / 2 + pad / 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${text}</text>`;
  } else if (style.frame === "badge") {
    const bw = Math.min(W - pad * 2, Math.max(size * 0.45, text.length * fontSize * 0.65 + pad * 2));
    frame = `<rect x="${pad / 2}" y="${pad / 2}" width="${W - pad}" height="${size + pad}" rx="${pad * 1.5}" fill="none" stroke="${fc}" stroke-width="${Math.max(2, pad / 3)}"/>
<rect x="${(W - bw) / 2}" y="${size + pad - labelH * 0.25}" width="${bw}" height="${labelH * 0.9}" rx="${labelH * 0.45}" fill="${fc}"/>
<text x="${W / 2}" y="${size + pad + labelH * 0.2}" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${text}</text>`;
  }

  const bg = style.bg === "transparent" ? "" : `<rect x="${pad}" y="${qrY}" width="${size}" height="${size}" fill="${style.bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="geometricPrecision">
<defs>${defs}</defs>
${bg}
<g transform="translate(${pad},${qrY})" fill="${fill}">${parts.join("")}</g>
${logo ? `<g transform="translate(${pad},${qrY})">${logo}</g>` : ""}
${frame}
</svg>`;
}

/** Resolves a logo URL to a data URI so PNG rasterization (librsvg) can embed it. */
export async function inlineLogo(logo: string | null | undefined): Promise<string | null> {
  if (!logo) return null;
  if (logo.startsWith("data:")) return logo;
  try {
    let buf: Buffer; let mime = "image/png";
    if (logo.startsWith("/")) {
      const p = path.join(process.cwd(), "public", logo.split("?")[0]);
      buf = await fs.readFile(p);
      const ext = p.split(".").pop()?.toLowerCase();
      mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";
    } else {
      const res = await fetch(logo, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      mime = res.headers.get("content-type")?.split(";")[0] || mime;
      buf = Buffer.from(await res.arrayBuffer());
    }
    if (buf.length > 2 * 1024 * 1024) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

/** Rasterizes an SVG string to PNG with sharp. */
export async function renderQrPng(svg: string, width?: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  let img = sharp(Buffer.from(svg), { density: 300 });
  if (width) img = img.resize(width, undefined, { fit: "inside" });
  return img.png().toBuffer();
}

/** Produces a minimal single-page PDF embedding the QR as a JPEG image (DCTDecode). */
export async function renderQrPdf(svg: string, width = 1000): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(Buffer.from(svg), { density: 300 }).resize(width, undefined, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  const w = meta.width ?? width, h = meta.height ?? width;
  const pageW = 595, pageH = 842; // A4 points
  const scale = Math.min((pageW - 80) / w, (pageH - 80) / h);
  const dw = w * scale, dh = h * scale, dx = (pageW - dw) / 2, dy = (pageH - dh) / 2;
  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im1 Do Q`;
  const objects: (string | Buffer)[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from("\nendstream")]),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets: number[] = [];
  let pos = chunks[0].length;
  objects.forEach((obj, i) => {
    offsets.push(pos);
    const head = Buffer.from(`${i + 1} 0 obj\n`);
    const body = typeof obj === "string" ? Buffer.from(obj) : obj;
    const tail = Buffer.from("\nendobj\n");
    chunks.push(head, body, tail);
    pos += head.length + body.length + tail.length;
  });
  const xref = pos;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) table += `${String(o).padStart(10, "0")} 00000 n \n`;
  table += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  chunks.push(Buffer.from(table));
  return Buffer.concat(chunks);
}
