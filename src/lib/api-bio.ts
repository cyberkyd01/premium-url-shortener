import { db } from "./db";
import { ApiRequestError, asArray, asBool, asNumber, asRecord, asString, asStringArray, isRecord } from "./api-helpers";
import { isAliasAvailable } from "./links";
import { isValidAlias, isValidUrl, normalizeUrl } from "./utils";
import bcrypt from "bcryptjs";

export const BIO_BLOCK_TYPES = ["link", "heading", "text", "image", "gallery", "carousel", "video", "audio", "youtube", "vimeo", "spotify", "soundcloud", "applemusic", "tiktok", "twitter", "instagram", "facebook", "linkedin", "threads", "reddit", "pinterest", "snapchat", "telegram", "whatsapp", "discord", "twitch", "github", "email", "phone", "vcard", "contact", "newsletter", "faq", "poll", "countdown", "map", "calendly", "typeform", "eventbrite", "opentable", "booking", "music", "giphy", "rss", "divider", "html", "featured", "product", "paypal", "donation", "app", "file", "pdf", "cookie"];
const LAYOUTS = ["centered", "left", "split", "card", "grid"];
const BUTTON_STYLES = ["rounded", "square", "pill", "outline", "shadow", "frosted", "hard-shadow"];

export async function validateBioAlias(alias: string, domainId: string | null, excludeId?: string) {
  if (!isValidAlias(alias)) throw new ApiRequestError("Alias may only contain letters, numbers, dashes and underscores");
  const existing = await db.bioPage.findFirst({ where: { alias, domainId, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (existing) throw new ApiRequestError("This alias is already taken", 409);
  if (!(await isAliasAvailable(alias, domainId))) throw new ApiRequestError("This alias is already taken", 409);
}

export interface BioFields {
  alias?: string; name?: string | null; bio?: string | null; avatar?: string | null; cover?: string | null; customCss?: string | null; customJs?: string | null; customLogo?: string | null; contactEmail?: string | null;
  theme?: string; layout?: string; buttonStyle?: string; font?: string; colors?: string; seo?: string; socials?: string; socialsPosition?: string; password?: string | null; ageGate?: number | null;
  sensitive?: boolean; newsletterGate?: boolean; nsfwWarning?: boolean; hideBranding?: boolean; isDefault?: boolean; status?: string;
}

/** Shared field mapping for bio page create/update (plain scalars, usable in both create and update). */
export async function bioDataFromBody(body: Record<string, unknown>, current?: { id: string; alias: string; domainId: string | null }): Promise<BioFields> {
  const data: BioFields = {};
  const alias = asString(body.alias)?.trim();
  if (alias && alias !== current?.alias) { await validateBioAlias(alias, current?.domainId ?? null, current?.id); data.alias = alias; }
  for (const k of ["name", "bio", "avatar", "cover", "customCss", "customJs", "customLogo", "contactEmail"] as const) {
    if (k in body) data[k] = asString(body[k])?.slice(0, k === "customCss" || k === "customJs" ? 20000 : 500) || null;
  }
  const theme = asString(body.theme);
  if (theme) data.theme = theme.slice(0, 50);
  const layout = asString(body.layout);
  if (layout) { if (!LAYOUTS.includes(layout)) throw new ApiRequestError("Invalid layout"); data.layout = layout; }
  const buttonStyle = asString(body.buttonStyle);
  if (buttonStyle) { if (!BUTTON_STYLES.includes(buttonStyle)) throw new ApiRequestError("Invalid buttonStyle"); data.buttonStyle = buttonStyle; }
  const font = asString(body.font);
  if (font) data.font = font.slice(0, 50);
  const colors = asRecord(body.colors);
  if (colors) data.colors = JSON.stringify(colors);
  const seo = asRecord(body.seo);
  if (seo) data.seo = JSON.stringify(seo);
  const socials = asArray(body.socials);
  if (socials) data.socials = JSON.stringify(socials.filter(isRecord));
  const socialsPosition = asString(body.socialsPosition);
  if (socialsPosition) data.socialsPosition = socialsPosition;
  if ("password" in body) { const pw = asString(body.password); data.password = pw ? await bcrypt.hash(pw, 8) : null; }
  if ("ageGate" in body) data.ageGate = asNumber(body.ageGate) ?? null;
  for (const k of ["sensitive", "newsletterGate", "nsfwWarning", "hideBranding", "isDefault"] as const) {
    const v = asBool(body[k]);
    if (v !== undefined) data[k] = v;
  }
  const status = asString(body.status);
  if (status) { if (!["active", "disabled"].includes(status)) throw new ApiRequestError("Invalid status (active|disabled)"); data.status = status; }
  return data;
}

export interface BlockInput { type: string; title: string | null; url: string | null; content: string; thumbnail: string | null; order?: number; enabled?: boolean; scheduleStart?: Date | null; scheduleEnd?: Date | null; countries?: string; languages?: string; sensitive?: boolean; gated?: string | null; animation?: string | null }

export function blockFromBody(body: Record<string, unknown>, partial = false): Partial<BlockInput> {
  const out: Partial<BlockInput> = {};
  const type = asString(body.type)?.toLowerCase();
  if (type) { if (!BIO_BLOCK_TYPES.includes(type)) throw new ApiRequestError("Invalid block type: " + type); out.type = type; }
  else if (!partial) throw new ApiRequestError("Missing required parameter: type");
  if ("title" in body) out.title = asString(body.title)?.slice(0, 200) || null;
  if ("url" in body) {
    const u = asString(body.url)?.trim();
    if (u) { const n = /^(mailto|tel|sms):/.test(u) ? u : normalizeUrl(u); if (!isValidUrl(n)) throw new ApiRequestError("Invalid block url"); out.url = n; }
    else out.url = null;
  }
  if ("content" in body) { const c = asRecord(body.content); out.content = JSON.stringify(c ?? (asString(body.content) ? { text: asString(body.content) } : {})); }
  if ("thumbnail" in body) out.thumbnail = asString(body.thumbnail) || null;
  const order = asNumber(body.order);
  if (order !== undefined) out.order = order;
  const enabled = asBool(body.enabled);
  if (enabled !== undefined) out.enabled = enabled;
  for (const k of ["scheduleStart", "scheduleEnd"] as const) {
    if (k in body) { const s = asString(body[k]); const d = s ? new Date(s) : null; if (d && isNaN(d.getTime())) throw new ApiRequestError("Invalid " + k); out[k] = d; }
  }
  const countries = asStringArray(body.countries);
  if (countries) out.countries = JSON.stringify(countries.map((c) => c.toUpperCase()));
  const languages = asStringArray(body.languages);
  if (languages) out.languages = JSON.stringify(languages.map((l) => l.toLowerCase()));
  const sensitive = asBool(body.sensitive);
  if (sensitive !== undefined) out.sensitive = sensitive;
  if ("gated" in body) out.gated = asString(body.gated) || null;
  if ("animation" in body) out.animation = asString(body.animation) || null;
  return out;
}
