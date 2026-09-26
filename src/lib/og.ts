import { appUrl } from "./utils";

export type OgType = "link" | "bio" | "qr" | "report";

export interface OgParams { title: string; subtitle?: string | null; type?: OgType; color?: string | null }

/** Absolute URL of the branded 1200x630 Open Graph card rendered by GET /api/og. */
export function ogImageUrl(params: OgParams) {
  const q = new URLSearchParams({ title: params.title.slice(0, 120) });
  if (params.subtitle) q.set("subtitle", params.subtitle.slice(0, 160));
  if (params.type) q.set("type", params.type);
  if (params.color && /^#?[0-9a-fA-F]{6}$/.test(params.color)) q.set("color", params.color.replace(/^#/, ""));
  return appUrl("/api/og?" + q.toString());
}
