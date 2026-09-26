import { db } from "./db";
import { getSettings } from "./settings";
import { resolveHost } from "./resolve-host";
import { json } from "./utils";

export interface Branding {
  name: string;
  logo: string | null;
  favicon: string | null;
  /** Hex colors; null keeps the theme defaults. */
  primary: string | null;
  accent: string | null;
  hideBranding: boolean;
  loginTitle: string;
  /** True when a custom domain with its own branding served this request. */
  custom: boolean;
  domainId: string | null;
  host: string;
}

export type BrandingInput = Partial<Pick<Branding, "name" | "logo" | "favicon" | "primary" | "accent" | "hideBranding" | "loginTitle">>;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const clean = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const color = (v: unknown) => { const c = clean(v, 7); return c && HEX.test(c) ? c.toLowerCase() : null; };

/** Validates and normalizes a branding payload before it is stored in Domain.branding. */
export function normalizeBranding(input: Record<string, unknown>): Required<BrandingInput> {
  return {
    name: clean(input.name, 80) ?? "",
    logo: clean(input.logo, 500), favicon: clean(input.favicon, 500),
    primary: color(input.primary), accent: color(input.accent),
    hideBranding: input.hideBranding === true || input.hideBranding === "1" || input.hideBranding === "on",
    loginTitle: clean(input.loginTitle, 120) ?? "",
  };
}

export function parseBranding(raw: string | null | undefined) {
  return normalizeBranding(json<Record<string, unknown>>(raw, {}));
}

/** Resolves the branding for the current request host: Domain.branding merged with the site defaults. */
export async function getBranding(headers: Headers): Promise<Branding> {
  const s = await getSettings();
  const base: Branding = { name: s["site.name"], logo: s["site.logo"] || null, favicon: s["site.favicon"] || null, primary: null, accent: null, hideBranding: false, loginTitle: "Welcome back", custom: false, domainId: null, host: headers.get("host") ?? "" };
  try {
    const ctx = await resolveHost(headers.get("host"));
    if (ctx.isMain || !ctx.domain) return base;
    const b = parseBranding(ctx.domain.branding);
    const custom = !!(b.name || b.logo || b.favicon || b.primary || b.accent || b.hideBranding || b.loginTitle);
    return {
      ...base, custom, domainId: ctx.domain.id,
      name: b.name || base.name, logo: b.logo ?? base.logo, favicon: b.favicon ?? base.favicon,
      primary: b.primary, accent: b.accent, hideBranding: b.hideBranding, loginTitle: b.loginTitle || base.loginTitle,
    };
  } catch { return base; }
}

/** Inline CSS that overrides the theme tokens for a branded host (empty when no colors are set). */
export function brandingCss(b: Pick<Branding, "primary" | "accent">) {
  const vars: string[] = [];
  if (b.primary) vars.push(`--primary:${b.primary}`, `--color-primary:${b.primary}`);
  if (b.accent) vars.push(`--accent:${b.accent}`, `--color-accent:${b.accent}`);
  return vars.length ? `:root,.dark{${vars.join(";")}}` : "";
}

/** Saves branding for a domain owned by `ownerId`. */
export async function saveDomainBranding(domainId: string, ownerId: string, input: Record<string, unknown>) {
  const domain = await db.domain.findFirst({ where: { id: domainId, userId: ownerId } });
  if (!domain) return null;
  const data = normalizeBranding(input);
  await db.domain.update({ where: { id: domainId }, data: { branding: JSON.stringify(data) } });
  return data;
}
