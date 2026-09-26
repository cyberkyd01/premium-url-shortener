import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { appHost } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { link: "Short link", bio: "Bio page", qr: "QR code", report: "Analytics report" };

function shade(hex: string, amount: number) {
  const n = parseInt(hex, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** GET /api/og?title=&subtitle=&type=link|bio|qr|report&color=6366f1 — 1200x630 branded Open Graph card. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const s = await getSettings();
  const siteName = s["site.name"] || "Premium URL Shortener";
  const title = (q.get("title") || siteName).slice(0, 120);
  const subtitle = (q.get("subtitle") || "").slice(0, 160);
  const type = q.get("type") || "link";
  const colorRaw = (q.get("color") || "6366f1").replace(/^#/, "");
  const color = /^[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : "6366f1";
  const from = `#${color}`;
  const to = shade(color, -70);
  const label = LABELS[type] ?? LABELS.link;
  const big = title.length > 60;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`, color: "#fff", fontFamily: "Inter, Arial, sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", right: -120, top: -120, width: 420, height: 420, borderRadius: 999, background: "rgba(255,255,255,0.10)", display: "flex" }} />
        <div style={{ position: "absolute", right: 120, bottom: -200, width: 360, height: 360, borderRadius: 999, background: "rgba(255,255,255,0.08)", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🔗</div>
            {siteName}
          </div>
          <div style={{ fontSize: 22, padding: "8px 20px", borderRadius: 999, background: "rgba(255,255,255,0.18)", display: "flex" }}>{label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1000 }}>
          <div style={{ fontSize: big ? 52 : 68, fontWeight: 800, lineHeight: 1.1, display: "flex", overflow: "hidden" }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 30, opacity: 0.85, display: "flex", lineHeight: 1.3 }}>{subtitle}</div> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 22, opacity: 0.8 }}>
          <div style={{ display: "flex" }}>{appHost()}</div>
          <div style={{ display: "flex" }}>Smart links, bio pages, QR codes &amp; analytics</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } },
  );
}
