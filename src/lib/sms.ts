/** Twilio SMS via REST API (basic auth). Per-user credentials stored on User (twilioSid, twilioToken, twilioFrom). */
export interface TwilioCreds { sid: string; token: string; from: string }

export function isE164(phone: string) {
  return /^\+[1-9]\d{6,14}$/.test(phone.trim());
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/[\s()-]/g, "");
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (/^\d+$/.test(digits)) return "+" + digits;
  return digits;
}

export async function sendSms(creds: TwilioCreds, to: string, body: string): Promise<{ ok: true; sid: string; status: string } | { ok: false; error: string }> {
  if (!creds.sid || !creds.token || !creds.from) return { ok: false, error: "Twilio credentials are not configured" };
  if (!isE164(to)) return { ok: false, error: "Phone number must be in E.164 format (e.g. +14155552671)" };
  try {
    const params = new URLSearchParams({ To: to, Body: body });
    if (creds.from.startsWith("MG")) params.set("MessagingServiceSid", creds.from); else params.set("From", creds.from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.sid)}/Messages.json`, {
      method: "POST",
      headers: { authorization: "Basic " + Buffer.from(`${creds.sid}:${creds.token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const d = (await r.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string };
    if (!r.ok || !d.sid) return { ok: false, error: d.message || `Twilio error ${r.status}` };
    return { ok: true, sid: d.sid, status: d.status ?? "queued" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Finds http(s) URLs inside a message body. */
export function extractUrls(body: string) {
  return Array.from(new Set(body.match(/https?:\/\/[^\s<>"']+/g) ?? []));
}
