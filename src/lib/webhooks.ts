import crypto from "crypto";
import type { Webhook, WebhookLog } from "@prisma/client";
import { db } from "./db";
import { notify } from "./notify";

export type WebhookEvent = "link.created" | "link.clicked" | "bio.viewed" | "qr.scanned" | "link.updated" | "link.deleted";
export type WebhookProvider = "zapier" | "custom" | "slack" | "discord" | "telegram" | "teams";

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
  { value: "link.created", label: "Link created" },
  { value: "link.updated", label: "Link updated" },
  { value: "link.deleted", label: "Link deleted" },
  { value: "link.clicked", label: "Link clicked" },
  { value: "bio.viewed", label: "Bio page viewed" },
  { value: "qr.scanned", label: "QR code scanned" },
];

/** Providers with UI labels + setup instructions (used by the integrations page). */
export const WEBHOOK_PROVIDERS: { value: WebhookProvider; label: string; urlLabel: string; secretLabel: string | null; instructions: string }[] = [
  { value: "zapier", label: "Zapier", urlLabel: "Catch Hook URL", secretLabel: "Signing secret (optional)", instructions: "Create a Zap with the \"Webhooks by Zapier\" trigger (Catch Hook) and paste the URL here. Payloads are JSON: { event, data, timestamp }." },
  { value: "custom", label: "Custom / Make / n8n", urlLabel: "Endpoint URL", secretLabel: "Signing secret (optional)", instructions: "We POST JSON to your endpoint. When a secret is set, the X-Signature header contains an HMAC-SHA256 hex digest of the raw body." },
  { value: "slack", label: "Slack", urlLabel: "Incoming Webhook URL", secretLabel: null, instructions: "In Slack, add the \"Incoming Webhooks\" app to a channel and paste the generated https://hooks.slack.com/services/... URL." },
  { value: "discord", label: "Discord", urlLabel: "Webhook URL", secretLabel: null, instructions: "Open the channel settings → Integrations → Webhooks → New Webhook and paste the https://discord.com/api/webhooks/... URL." },
  { value: "telegram", label: "Telegram", urlLabel: "Bot API URL", secretLabel: "Chat ID", instructions: "Create a bot with @BotFather, then enter https://api.telegram.org/bot<TOKEN>/sendMessage as the URL and your chat id (send /start to the bot and read it from getUpdates) as the secret." },
  { value: "teams", label: "Microsoft Teams", urlLabel: "Incoming Webhook / Workflow URL", secretLabel: null, instructions: "In Teams, add an Incoming Webhook connector (or a Workflow \"post to channel when a webhook request is received\") and paste the URL." },
];

/** Retry backoff after the n-th failed attempt (1m, 5m, 30m, 2h, 12h). */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 12 * 3600_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const DISABLE_AFTER_FAILURES = 20;
const TIMEOUT_MS = 8000;

function eventTitle(event: string) {
  return WEBHOOK_EVENTS.find((e) => e.value === event)?.label ?? event;
}

function flat(payload: Record<string, unknown>) {
  return Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)] as const);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** Builds the provider-specific request for one delivery. */
export function formatWebhookRequest(hook: Pick<Webhook, "provider" | "secret" | "url">, event: string, payload: Record<string, unknown>) {
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "PremiumURLShortener-Webhook/2.0" };
  const title = eventTitle(event);
  const fields = flat(payload);
  const provider = hook.provider as WebhookProvider;
  let body: string;
  switch (provider) {
    case "slack":
      body = JSON.stringify({
        text: `${title}: ${fields.map(([k, v]) => `${k}=${v}`).join(", ")}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: title } },
          { type: "section", fields: fields.slice(0, 10).map(([k, v]) => ({ type: "mrkdwn", text: `*${k}*\n${v.slice(0, 200)}` })) },
          { type: "context", elements: [{ type: "mrkdwn", text: `event \`${event}\` · ${new Date().toISOString()}` }] },
        ],
      });
      break;
    case "discord":
      body = JSON.stringify({
        content: title,
        embeds: [{ title, description: `Event \`${event}\``, color: 0x6366f1, timestamp: new Date().toISOString(), fields: fields.slice(0, 25).map(([k, v]) => ({ name: k, value: v.slice(0, 1000), inline: v.length < 40 })) }],
      });
      break;
    case "telegram": {
      const text = [`<b>${escapeHtml(title)}</b>`, ...fields.map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(v.slice(0, 500))}`)].join("\n");
      body = JSON.stringify({ chat_id: hook.secret ?? "", text, parse_mode: "HTML", disable_web_page_preview: true });
      break;
    }
    case "teams":
      body = JSON.stringify({
        type: "message",
        summary: title,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4",
            body: [
              { type: "TextBlock", size: "Medium", weight: "Bolder", text: title },
              { type: "FactSet", facts: fields.slice(0, 20).map(([k, v]) => ({ title: k, value: v.slice(0, 300) })) },
              { type: "TextBlock", isSubtle: true, spacing: "Small", text: `event ${event} · ${new Date().toISOString()}` },
            ],
          },
        }],
        // Legacy MessageCard fields for older connectors
        "@type": "MessageCard", "@context": "https://schema.org/extensions", themeColor: "6366f1", title,
        sections: [{ facts: fields.slice(0, 20).map(([k, v]) => ({ name: k, value: v.slice(0, 300) })) }],
      });
      break;
    default:
      body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      if (hook.secret) headers["x-signature"] = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
  }
  return { headers, body };
}

async function send(hook: Webhook, event: string, body: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal });
    const text = (await r.text().catch(() => "")).slice(0, 500);
    return { status: r.status, response: text, success: r.ok };
  } catch (e) {
    return { status: null, response: (e instanceof Error ? e.message : "Request failed").slice(0, 500), success: false };
  } finally { clearTimeout(t); }
}

async function afterAttempt(hook: Webhook, ok: boolean) {
  if (ok) {
    await db.webhook.update({ where: { id: hook.id }, data: { lastCalledAt: new Date(), failures: 0 } });
    return;
  }
  const failures = hook.failures + 1;
  const disable = failures >= DISABLE_AFTER_FAILURES;
  await db.webhook.update({ where: { id: hook.id }, data: { failures, ...(disable ? { active: false } : {}) } });
  if (disable) {
    await notify(hook.userId, "Webhook disabled", `"${hook.name}" was disabled after ${failures} consecutive failed deliveries. Fix the endpoint and re-enable it.`, { type: "warning", link: "/dashboard/webhooks" });
  }
}

/** Performs one delivery attempt and records/updates the WebhookLog row. */
async function deliver(hook: Webhook, event: string, payload: Record<string, unknown>, existing?: WebhookLog) {
  const { headers, body } = formatWebhookRequest(hook, event, payload);
  const res = await send(hook, event, body, headers);
  const attempts = (existing?.attempts ?? 0) + 1;
  const nextRetryAt = res.success || attempts >= MAX_ATTEMPTS ? null : new Date(Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]);
  const data = { event, payload: JSON.stringify(payload), status: res.status, response: res.response, attempts, success: res.success, nextRetryAt };
  const log = existing
    ? await db.webhookLog.update({ where: { id: existing.id }, data })
    : await db.webhookLog.create({ data: { webhookId: hook.id, ...data } });
  const fresh = await db.webhook.findUnique({ where: { id: hook.id } });
  if (fresh) await afterAttempt(fresh, res.success);
  return log;
}

/** Dispatches all active webhooks of a user subscribed to `event` (fire-and-forget safe). */
export async function dispatchWebhooks(userId: string | null | undefined, event: WebhookEvent, payload: Record<string, unknown>) {
  if (!userId) return;
  const hooks = await db.webhook.findMany({ where: { userId, active: true } });
  const subscribed = hooks.filter((h) => { try { return (JSON.parse(h.events) as string[]).includes(event); } catch { return false; } });
  await Promise.allSettled(subscribed.map((h) => deliver(h, event, payload)));
}

/** Re-sends a single log entry immediately (manual "retry now"). */
export async function retryWebhookLog(logId: string, userId: string) {
  const log = await db.webhookLog.findUnique({ where: { id: logId }, include: { webhook: true } });
  if (!log || log.webhook.userId !== userId) return null;
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(log.payload) as Record<string, unknown>; } catch { /* keep empty */ }
  return deliver(log.webhook, log.event, payload, log);
}

/** Cron: retries failed deliveries whose backoff window elapsed. */
export async function retryFailedWebhooks(limit = 100) {
  const due = await db.webhookLog.findMany({ where: { success: false, nextRetryAt: { lte: new Date() }, webhook: { active: true } }, include: { webhook: true }, orderBy: { nextRetryAt: "asc" }, take: limit });
  let retried = 0, succeeded = 0;
  for (const log of due) {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(log.payload) as Record<string, unknown>; } catch { /* ignore */ }
    const r = await deliver(log.webhook, log.event, payload, log);
    retried++;
    if (r.success) succeeded++;
  }
  return { retried, succeeded };
}

/** Sends a sample payload to verify a webhook configuration. */
export async function testWebhook(hookId: string, userId: string) {
  const hook = await db.webhook.findFirst({ where: { id: hookId, userId } });
  if (!hook) return null;
  return deliver(hook, "link.created", { id: "test", alias: "example", short: "https://example.com/example", url: "https://example.com", test: true });
}
