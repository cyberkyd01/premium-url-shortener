import crypto from "crypto";
import { getSettings } from "./settings";

export interface MailchimpConfig { apiKey: string; listId: string; doubleOptIn?: boolean }
export type MailchimpSource = "plugin" | "bio";

const TIMEOUT_MS = 8000;

function dataCenter(apiKey: string) {
  const dc = apiKey.split("-").pop();
  return dc && /^[a-z]{2}\d{1,3}$/i.test(dc) ? dc : null;
}

/**
 * Resolves the Mailchimp credentials to use.
 *  - "plugin": the Mailchimp add-on keys (`plugin.mailchimp.*`), falling back to the bio newsletter keys.
 *  - "bio": the bio newsletter keys (`bio.mailchimpKey` / `bio.mailchimpList`), falling back to the add-on keys.
 * Returns null when nothing is configured.
 */
export async function mailchimpConfig(source: MailchimpSource = "plugin"): Promise<MailchimpConfig | null> {
  const s = await getSettings();
  const plugin: MailchimpConfig = { apiKey: s["plugin.mailchimp.apiKey"] || "", listId: s["plugin.mailchimp.listId"] || "", doubleOptIn: s["plugin.mailchimp.doubleOptIn"] === "1" };
  const bio: MailchimpConfig = { apiKey: s["bio.mailchimpKey"] || "", listId: s["bio.mailchimpList"] || "", doubleOptIn: false };
  const order = source === "bio" ? [bio, plugin] : [plugin, bio];
  return order.find((c) => c.apiKey && c.listId) ?? null;
}

/**
 * Adds or updates a list member (PUT lists/{list}/members/{md5(email)}), which is idempotent.
 * Never throws: returns `{ ok, status, error }` so callers can fire-and-forget.
 */
export async function subscribeMember(
  email: string,
  merge: Record<string, string> = {},
  opts: { source?: MailchimpSource; config?: MailchimpConfig; tags?: string[] } = {},
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  const cfg = opts.config ?? (await mailchimpConfig(opts.source));
  if (!cfg) return { ok: false, status: null, error: "Mailchimp is not configured" };
  const dc = dataCenter(cfg.apiKey);
  if (!dc) return { ok: false, status: null, error: "Invalid Mailchimp API key (missing data center suffix)" };
  const addr = email.trim().toLowerCase();
  const hash = crypto.createHash("md5").update(addr).digest("hex");
  const status = cfg.doubleOptIn ? "pending" : "subscribed";
  const body: Record<string, unknown> = { email_address: addr, status_if_new: status, status, merge_fields: merge };
  if (opts.tags?.length) body.tags = opts.tags;
  try {
    const r = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(cfg.listId)}/members/${hash}`, {
      method: "PUT",
      headers: { Authorization: "Basic " + Buffer.from("anystring:" + cfg.apiKey).toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) return { ok: true, status: r.status };
    const text = (await r.text().catch(() => "")).slice(0, 300);
    return { ok: false, status: r.status, error: text || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message : "Request failed" };
  }
}
