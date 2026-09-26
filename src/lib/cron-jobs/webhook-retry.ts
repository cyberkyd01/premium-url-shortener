import crypto from "crypto";
import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 60_000; // 1m, 2m, 4m, 8m, 16m

export function nextRetryDelay(attempts: number) {
  return BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1);
}

/** Re-sends failed WebhookLog deliveries whose `nextRetryAt` has passed (max 5 attempts, exponential backoff). */
export async function webhookRetryJob(limit = 100): Promise<Record<string, unknown>> {
  const now = new Date();
  const due = await db.webhookLog.findMany({
    where: { success: false, attempts: { lt: MAX_ATTEMPTS }, nextRetryAt: { lte: now } },
    include: { webhook: true },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });
  let delivered = 0, rescheduled = 0, abandoned = 0, inactive = 0;
  for (const log of due) {
    if (!log.webhook.active) { inactive++; await db.webhookLog.update({ where: { id: log.id }, data: { nextRetryAt: null } }); continue; }
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "PremiumURLShortener-Webhook/1.0", "x-webhook-attempt": String(log.attempts + 1) };
    if (log.webhook.secret) headers["x-signature"] = crypto.createHmac("sha256", log.webhook.secret).update(log.payload).digest("hex");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let status: number | null = null;
    let response = "";
    let ok = false;
    try {
      const res = await fetch(log.webhook.url, { method: "POST", headers, body: log.payload, signal: controller.signal });
      status = res.status;
      response = (await res.text().catch(() => "")).slice(0, 1000);
      ok = res.ok;
    } catch (e) {
      response = (e instanceof Error ? e.message : "request failed").slice(0, 1000);
    } finally { clearTimeout(timer); }
    const attempts = log.attempts + 1;
    if (ok) {
      delivered++;
      await db.$transaction([
        db.webhookLog.update({ where: { id: log.id }, data: { success: true, status, response, attempts, nextRetryAt: null } }),
        db.webhook.update({ where: { id: log.webhookId }, data: { lastCalledAt: now, failures: 0 } }),
      ]);
    } else {
      const giveUp = attempts >= MAX_ATTEMPTS;
      if (giveUp) abandoned++; else rescheduled++;
      await db.$transaction([
        db.webhookLog.update({ where: { id: log.id }, data: { success: false, status, response, attempts, nextRetryAt: giveUp ? null : new Date(now.getTime() + nextRetryDelay(attempts)) } }),
        db.webhook.update({ where: { id: log.webhookId }, data: { failures: { increment: 1 } } }),
      ]);
    }
  }
  return { due: due.length, delivered, rescheduled, abandoned, inactive };
}
