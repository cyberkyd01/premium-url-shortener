export interface ThemeConfig { primary?: string; accent?: string; scheme?: string; homepage?: string; logo?: string; menu?: { label: string; url: string }[]; font?: string; palette?: string }

export interface SchemeColors { primary: string; primaryFg: string; accent: string; bg: string; card: string; fg: string; muted: string; border: string }
export interface ColorScheme { key: string; label: string; description: string; light: SchemeColors; dark: SchemeColors }

/** Built-in color schemes for the SaaS theme (plus "custom" which uses the primary/accent pickers). */
export const COLOR_SCHEMES: ColorScheme[] = [
  { key: "indigo", label: "Indigo", description: "The default violet-blue look.",
    light: { primary: "#6366f1", primaryFg: "#ffffff", accent: "#8b5cf6", bg: "#f8fafc", card: "#ffffff", fg: "#0f172a", muted: "#64748b", border: "#e2e8f0" },
    dark: { primary: "#818cf8", primaryFg: "#0b1120", accent: "#a78bfa", bg: "#0b1120", card: "#111827", fg: "#f1f5f9", muted: "#94a3b8", border: "#1f2937" } },
  { key: "ocean", label: "Ocean", description: "Sky blue and cyan, crisp and trustworthy.",
    light: { primary: "#0284c7", primaryFg: "#ffffff", accent: "#06b6d4", bg: "#f5f9fc", card: "#ffffff", fg: "#0c1a2b", muted: "#5b7083", border: "#dbe6ef" },
    dark: { primary: "#38bdf8", primaryFg: "#06111f", accent: "#22d3ee", bg: "#06111f", card: "#0d1b2e", fg: "#e6f1fb", muted: "#8fa6bb", border: "#1a2b40" } },
  { key: "emerald", label: "Emerald", description: "Green and teal, fresh and growth-oriented.",
    light: { primary: "#059669", primaryFg: "#ffffff", accent: "#14b8a6", bg: "#f6faf8", card: "#ffffff", fg: "#0b1f17", muted: "#5f7a6e", border: "#d9e7e0" },
    dark: { primary: "#34d399", primaryFg: "#04150f", accent: "#2dd4bf", bg: "#04150f", card: "#0b221a", fg: "#e7f6ef", muted: "#8fb3a3", border: "#173328" } },
  { key: "sunset", label: "Sunset", description: "Warm orange and pink for bold brands.",
    light: { primary: "#ea580c", primaryFg: "#ffffff", accent: "#ec4899", bg: "#fcf8f5", card: "#ffffff", fg: "#231410", muted: "#7c6459", border: "#efe2da" },
    dark: { primary: "#fb923c", primaryFg: "#1a0d08", accent: "#f472b6", bg: "#160c08", card: "#241410", fg: "#fbf1ea", muted: "#b39a8d", border: "#3a241b" } },
  { key: "rose", label: "Rose", description: "Rose and fuchsia, elegant and modern.",
    light: { primary: "#e11d48", primaryFg: "#ffffff", accent: "#d946ef", bg: "#fdf7f9", card: "#ffffff", fg: "#24101a", muted: "#7d6270", border: "#f0dde5" },
    dark: { primary: "#fb7185", primaryFg: "#1c0a11", accent: "#e879f9", bg: "#160a10", card: "#23111a", fg: "#fbeef3", muted: "#b6939f", border: "#3a1f2b" } },
];

export function colorScheme(key: string | undefined) {
  return COLOR_SCHEMES.find((c) => c.key === key) ?? null;
}

function vars(c: SchemeColors) {
  return `--primary:${c.primary};--primary-fg:${c.primaryFg};--accent:${c.accent};--bg:${c.bg};--card:${c.card};--fg:${c.fg};--muted:${c.muted};--border:${c.border};`;
}

/** CSS that applies a theme config: a built-in palette sets every color for light and dark; otherwise the primary/accent pickers override the defaults. */
export function themeCss(cfg: ThemeConfig) {
  const scheme = colorScheme(cfg.palette);
  const font = cfg.font ? `--font-sans:"${cfg.font.replace(/["\\]/g, "")}",ui-sans-serif,system-ui,sans-serif;` : "";
  if (scheme) return `:root{${vars(scheme.light)}${font}}.dark{${vars(scheme.dark)}}`;
  const custom = `${cfg.primary ? `--primary:${cfg.primary};` : ""}${cfg.accent ? `--accent:${cfg.accent};` : ""}${font}`;
  return custom ? `:root{${custom}}` : "";
}
