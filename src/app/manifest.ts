import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings().catch(() => ({} as Record<string, string>));
  const name = s["site.name"] || "URL Shortener";
  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: s["site.tagline"] || s["site.description"] || "Short links, QR codes and bio pages",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#6366f1",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shorten a link", url: "/dashboard/links/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My links", url: "/dashboard/links" },
      { name: "QR codes", url: "/dashboard/qr" },
    ],
    share_target: { action: "/share-target", method: "GET", enctype: "application/x-www-form-urlencoded", params: { url: "url", text: "text", title: "title" } },
  };
}
