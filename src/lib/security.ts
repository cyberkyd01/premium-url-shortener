import crypto from "crypto";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "./db";
import { getSettings } from "./settings";
import { ipBlocked } from "./redirect";
import { hostOf } from "./utils";
import { subscribeMember } from "./mailchimp";

/**
 * Built-in security / validation add-ons. Each one is a `Plugin` row (activated from /admin/plugins) whose
 * options live in the settings table under `plugin.<slug>.*`. Every check fails open on network errors.
 */

export type SecurityPluginSlug =
  | "emailvalidation" | "urlhaus" | "safebrowsing" | "whitelist" | "banip" | "blockcountries"
  | "restrictemails" | "blockemails" | "noindex" | "regwebhook" | "mailchimp" | "noip";

export interface CheckResult { ok: boolean; reason?: string }

const OK: CheckResult = { ok: true };
const TIMEOUT_MS = 8000;

// ---------------------------------------------------------------- plugin activation (cached)
const loadActivePlugins = unstable_cache(
  async () => (await db.plugin.findMany({ where: { active: true }, select: { slug: true } })).map((p) => p.slug),
  ["plugins-active"],
  { tags: ["plugins"], revalidate: 300 },
);

/** Active plugin slugs (cached under the "plugins" tag; call `revalidatePlugins()` after toggling). */
export async function activePlugins(): Promise<string[]> {
  try { return await loadActivePlugins(); } catch { return []; }
}

export async function isPluginActive(slug: string): Promise<boolean> {
  return (await activePlugins()).includes(slug);
}

export function revalidatePlugins() {
  revalidateTag("plugins");
}

// ---------------------------------------------------------------- helpers
/** Splits a textarea-style list (newline or comma separated) into trimmed, lowercase, unique entries. */
export function parseList(value: string | undefined | null): string[] {
  return [...new Set((value ?? "").split(/[\n,;]/).map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

function hostMatches(host: string, domain: string) {
  const d = domain.replace(/^\*?\./, "").replace(/^www\./, "");
  return !!d && (host === d || host.endsWith("." + d));
}

function emailDomain(email: string) {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

function countryListed(countryCode: string | null | undefined, list: string[]) {
  return !!countryCode && list.includes(countryCode.trim().toLowerCase());
}

async function fetchJson<T>(input: string, init: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

// ---------------------------------------------------------------- URL checks
interface UrlhausResponse { query_status?: string; url_status?: string; threat?: string }
interface SafeBrowsingResponse { matches?: { threatType?: string }[] }

/** URLhaus (abuse.ch): rejects URLs listed as malware distribution sites; optionally auto-bans the domain. */
export async function checkUrlhaus(url: string, s: Record<string, string>): Promise<CheckResult> {
  if (s["plugin.urlhaus.enabled"] === "0") return OK;
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (s["plugin.urlhaus.authKey"]) headers["Auth-Key"] = s["plugin.urlhaus.authKey"];
  const d = await fetchJson<UrlhausResponse>("https://urlhaus-api.abuse.ch/v1/url/", { method: "POST", headers, body: new URLSearchParams({ url }).toString() });
  if (!d || d.query_status !== "ok") return OK;
  if (s["plugin.urlhaus.autoBan"] === "1") {
    const host = hostOf(url);
    if (host) await db.blockedItem.upsert({ where: { type_value: { type: "domain", value: host } }, create: { type: "domain", value: host }, update: {} }).catch(() => {});
  }
  return { ok: false, reason: "This URL is listed as malicious by URLhaus" };
}

/** Google Safe Browsing Lookup API v4 (non-commercial): rejects on any threat match. */
export async function checkSafeBrowsing(url: string, s: Record<string, string>): Promise<CheckResult> {
  const key = s["plugin.safebrowsing.apiKey"] || process.env.GOOGLE_SAFEBROWSING_API_KEY || "";
  if (!key) return OK;
  const body = {
    client: { clientId: "premium-url-shortener", clientVersion: "1.0.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
      platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }],
    },
  };
  const d = await fetchJson<SafeBrowsingResponse>("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + encodeURIComponent(key), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (d?.matches?.length) return { ok: false, reason: "This URL was flagged as unsafe by Google Safe Browsing" };
  return OK;
}

/** Whitelist Domains: only hosts equal to / ending with a listed domain may be shortened. */
export function checkWhitelist(url: string, s: Record<string, string>): CheckResult {
  const domains = parseList(s["plugin.whitelist.domains"]);
  if (!domains.length) return OK;
  const host = hostOf(url).toLowerCase();
  if (!host) return OK; // mailto:/tel: links are validated elsewhere
  return domains.some((d) => hostMatches(host, d)) ? OK : { ok: false, reason: "Only links to approved domains can be shortened" };
}

/** URL-only checks (whitelist, URLhaus, Safe Browsing). Used by validateUrl so every create/update path is covered. */
export async function checkUrlAllowed(url: string): Promise<CheckResult> {
  const active = await activePlugins();
  if (!active.some((p) => ["whitelist", "urlhaus", "safebrowsing"].includes(p))) return OK;
  const s = await getSettings();
  if (active.includes("whitelist")) { const r = checkWhitelist(url, s); if (!r.ok) return r; }
  if (active.includes("urlhaus")) { const r = await checkUrlhaus(url, s); if (!r.ok) return r; }
  if (active.includes("safebrowsing")) { const r = await checkSafeBrowsing(url, s); if (!r.ok) return r; }
  return OK;
}

// ---------------------------------------------------------------- IP / country checks
function blockedCountries(s: Record<string, string>, pluginActive: boolean) {
  return [...parseList(s["security.blockedCountries"]), ...(pluginActive ? parseList(s["plugin.blockcountries.countries"]) : [])];
}

/** Ban IP Addresses / Block Countries. Skips whatever is not available (ip or countryCode undefined). */
async function checkVisitorAllowed(ip: string | null | undefined, countryCode: string | null | undefined, active: string[], s: Record<string, string>): Promise<CheckResult> {
  if (ip && active.includes("banip") && ipBlocked(ip, parseList(s["plugin.banip.ips"]))) return { ok: false, reason: "Your IP address is not allowed to use this service" };
  if (countryCode && countryListed(countryCode, blockedCountries(s, active.includes("blockcountries")))) return { ok: false, reason: "This service is not available in your country" };
  return OK;
}

/**
 * Shortening gate. `url` is optional because `validateUrl()` already runs the URL checks for every
 * create/update path; pass it only when calling outside of createLink/updateLink.
 */
export async function checkShortenAllowed(input: { url?: string; ip?: string | null; countryCode?: string | null }): Promise<CheckResult> {
  const active = await activePlugins();
  const s = await getSettings();
  const visitor = await checkVisitorAllowed(input.ip, input.countryCode, active, s);
  if (!visitor.ok) return visitor;
  if (input.url) return checkUrlAllowed(input.url);
  return OK;
}

// ---------------------------------------------------------------- registration checks
interface IpqsEmailResponse { success?: boolean; valid?: boolean; disposable?: boolean; fraud_score?: number; message?: string }

/** Email Validation (IPQualityScore): blocks invalid / disposable / high fraud-score addresses. Fails open. */
export async function checkEmailQuality(email: string, s: Record<string, string>): Promise<CheckResult> {
  const key = s["plugin.emailvalidation.apiKey"] || "";
  if (!key) return OK;
  const d = await fetchJson<IpqsEmailResponse>(`https://ipqualityscore.com/api/json/email/${encodeURIComponent(key)}/${encodeURIComponent(email)}`, { method: "GET" });
  if (!d || d.success === false) return OK;
  if (s["plugin.emailvalidation.blockInvalid"] !== "0" && d.valid === false) return { ok: false, reason: "This email address appears to be invalid." };
  if (s["plugin.emailvalidation.blockDisposable"] !== "0" && d.disposable === true) return { ok: false, reason: "Disposable email addresses are not allowed." };
  const threshold = parseInt(s["plugin.emailvalidation.minScoreBlock"] || "0", 10);
  if (threshold > 0 && typeof d.fraud_score === "number" && d.fraud_score >= threshold) return { ok: false, reason: "This email address was rejected by our fraud checks." };
  return OK;
}

/** Restrict Emails / Block Emails (+ the core `security.blockedEmails` list which may hold full addresses or @domain entries). */
export function checkEmailLists(email: string, s: Record<string, string>, active: string[]): CheckResult {
  const addr = email.trim().toLowerCase();
  const domain = emailDomain(addr);
  const denied = (entry: string) => (entry.startsWith("@") ? hostMatches(domain, entry.slice(1)) : entry.includes("@") ? addr === entry : hostMatches(domain, entry));
  if (parseList(s["security.blockedEmails"]).some(denied)) return { ok: false, reason: "This email address is not allowed." };
  if (active.includes("blockemails") && parseList(s["plugin.blockemails.domains"]).some(denied)) return { ok: false, reason: "This email address is not allowed." };
  if (active.includes("restrictemails")) {
    const allowed = parseList(s["plugin.restrictemails.domains"]);
    if (allowed.length && !allowed.some((d) => hostMatches(domain, d.replace(/^@/, "")))) return { ok: false, reason: "Registration is limited to approved email domains." };
  }
  return OK;
}

/** Registration gate used by the /register action (and available to the OAuth signIn callback). */
export async function checkRegistrationAllowed(input: { email: string; ip?: string | null; countryCode?: string | null }): Promise<CheckResult> {
  const active = await activePlugins();
  const s = await getSettings();
  const visitor = await checkVisitorAllowed(input.ip, input.countryCode, active, s);
  if (!visitor.ok) return visitor;
  const lists = checkEmailLists(input.email, s, active);
  if (!lists.ok) return lists;
  if (active.includes("emailvalidation")) { const q = await checkEmailQuality(input.email, s); if (!q.ok) return q; }
  return OK;
}

// ---------------------------------------------------------------- after registration
export interface RegisteredUser { id: string; username: string; email: string; plan?: string | null; createdAt?: Date | string | null }

/** Registration Webhook: POST {event:"user.registered", user} with an HMAC-SHA256 `x-signature` when a secret is set. */
export async function fireRegistrationWebhook(user: RegisteredUser): Promise<void> {
  if (!(await isPluginActive("regwebhook"))) return;
  const s = await getSettings();
  const url = (s["plugin.regwebhook.url"] || "").trim();
  if (!/^https?:\/\//i.test(url)) return;
  const body = JSON.stringify({
    event: "user.registered",
    user: { id: user.id, username: user.username, email: user.email, plan: user.plan ?? null, createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt ?? new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "PremiumURLShortener-Webhook/2.0" };
  const secret = s["plugin.regwebhook.secret"] || "";
  if (secret) headers["x-signature"] = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try { await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) }); } catch { /* fire and forget */ }
}

/** Mailchimp add-on: upserts the new user into the configured audience. */
export async function syncRegistrationToMailchimp(user: RegisteredUser): Promise<void> {
  if (!(await isPluginActive("mailchimp"))) return;
  const s = await getSettings();
  if (!s["plugin.mailchimp.apiKey"] || !s["plugin.mailchimp.listId"]) return;
  await subscribeMember(user.email, { FNAME: user.username }, { source: "plugin", tags: ["registered"] });
}

/** Runs every post-registration integration (webhook + Mailchimp). Safe to call without awaiting. */
export async function afterUserRegistered(user: RegisteredUser): Promise<void> {
  await Promise.allSettled([fireRegistrationWebhook(user), syncRegistrationToMailchimp(user)]);
}

/** Block Search Engines: whether short-link pages/responses should carry noindex hints. */
export async function noindexEnabled(): Promise<boolean> {
  if (!(await isPluginActive("noindex"))) return false;
  const s = await getSettings();
  return s["plugin.noindex.enabled"] !== "0";
}
