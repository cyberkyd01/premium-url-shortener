import { db } from "./db";
import { ApiRequestError, asBool, asRecord, asString } from "./api-helpers";
import { encodeQrData, isDynamicCapable, normalizeQrStyle } from "./qr-types";
import { isAliasAvailable, shortUrl } from "./links";
import { ALL_QR_TYPES, type PlanFeatures } from "./plan";
import { appUrl, randomAlias } from "./utils";

export interface QrPayload { type: string; data: string; linkId: string | null; bioPageId: string | null; content: string }

/** Coerces the submitted `data` (object or plain string) into the string map the QR encoder expects. */
function toStringMap(type: string, raw: unknown): Record<string, string> {
  const rec = asRecord(raw);
  if (rec) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) { if (v === null || v === undefined) continue; out[k] = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v); }
    return out;
  }
  const s = asString(raw);
  if (s === undefined) return {};
  return { [type === "text" ? "text" : "url"]: s };
}

/** Validates the submitted QR type + data against the plan and returns what to store in the QrCode row
 *  (`data` is always JSON so the renderer in `@/lib/qr` can re-encode it). */
export async function buildQrPayload(body: Record<string, unknown>, userId: string, isAdmin: boolean, features: PlanFeatures, existingType?: string): Promise<QrPayload> {
  const type = (asString(body.type) ?? existingType ?? "url").toLowerCase();
  if (!ALL_QR_TYPES.includes(type)) throw new ApiRequestError("Invalid QR type. Use one of: " + ALL_QR_TYPES.join(", "));
  if (!isAdmin && !features.qrTypes.includes(type)) throw new ApiRequestError(`QR type "${type}" is not available on your plan`, 402);
  const data = toStringMap(type, body.data ?? body.content ?? body.url ?? body.text);
  let linkId: string | null = null;
  let bioPageId: string | null = null;
  if (type === "link") {
    const ref = data.linkId || data.id || data.alias || asString(body.linkId ?? body.link) || "";
    if (!ref) throw new ApiRequestError("data.linkId is required for type=link");
    const link = await db.link.findFirst({ where: { OR: [{ id: ref }, { alias: ref }] }, include: { domain: true } });
    if (!link || (!isAdmin && link.userId !== userId)) throw new ApiRequestError("Link not found", 404);
    linkId = link.id;
    data.linkId = link.id;
    data.url = shortUrl(link);
  } else if (type === "bio") {
    const ref = data.bioPageId || data.id || data.alias || asString(body.bioPageId ?? body.bio) || "";
    if (!ref) throw new ApiRequestError("data.bioPageId is required for type=bio");
    const bio = await db.bioPage.findFirst({ where: { OR: [{ id: ref }, { alias: ref }] }, include: { domain: true } });
    if (!bio || (!isAdmin && bio.userId !== userId)) throw new ApiRequestError("Bio page not found", 404);
    bioPageId = bio.id;
    data.bioPageId = bio.id;
    data.url = bio.domain ? `https://${bio.domain.domain}/${bio.alias}` : appUrl("/" + bio.alias);
  }
  const content = encodeQrData(type, data);
  if (!content.trim() || /^(tel:|SMSTO:|mailto:|geo:,)$/.test(content)) throw new ApiRequestError("QR data is empty. Provide `data` for the chosen type");
  return { type, data: JSON.stringify(data), linkId, bioPageId, content };
}

/** Dynamic QR codes resolve at /{alias} (see src/app/[alias]), so the alias must be free across links, bio pages and QR codes. */
export async function uniqueQrAlias() {
  for (let i = 0; i < 10; i++) {
    const alias = randomAlias(8);
    if ((await isAliasAvailable(alias, null)) && !(await db.qrCode.findUnique({ where: { alias } }))) return alias;
  }
  throw new ApiRequestError("Could not allocate a QR alias", 500);
}

export function wantsDynamic(body: Record<string, unknown>, fallback: boolean, type: string) {
  const v = asBool(body.dynamic ?? body.isDynamic) ?? fallback;
  return v && isDynamicCapable(type);
}

/** Normalized style JSON for the DB column (matches what the dashboard stores). */
export function styleJson(style: Record<string, unknown>) {
  return JSON.stringify(normalizeQrStyle(style));
}
