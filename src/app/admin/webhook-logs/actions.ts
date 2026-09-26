"use server";
import { revalidatePath } from "next/cache";
import type { Webhook, WebhookLog } from "@prisma/client";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids, int } from "@/lib/admin/query";
import { formatWebhookRequest } from "@/lib/webhooks";
import { isRecord } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/components/ui/form-state";

const TIMEOUT_MS = 10_000;
/** Default failure threshold for the "disable failing webhooks" action. */
const DEFAULT_FAILURE_THRESHOLD = 5;

/** Re-POSTs the stored payload to the webhook URL (provider formatting + signature preserved) and updates the log row. */
async function redeliver(log: WebhookLog & { webhook: Webhook }) {
  let payload: Record<string, unknown> = {};
  try { const parsed: unknown = JSON.parse(log.payload); if (isRecord(parsed)) payload = parsed; } catch { /* keep empty payload */ }
  const { headers, body } = formatWebhookRequest(log.webhook, log.event, payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let status: number | null = null, response = "", success = false;
  try {
    const r = await fetch(log.webhook.url, { method: "POST", headers, body, signal: controller.signal });
    status = r.status; success = r.ok;
    response = (await r.text().catch(() => "")).slice(0, 500);
  } catch (e) {
    response = (e instanceof Error ? e.message : "Request failed").slice(0, 500);
  } finally { clearTimeout(timer); }
  await db.webhookLog.update({ where: { id: log.id }, data: { status, response, attempts: log.attempts + 1, success, nextRetryAt: null } });
  await db.webhook.update({ where: { id: log.webhookId }, data: success ? { lastCalledAt: new Date(), failures: 0 } : { failures: { increment: 1 } } });
  return { status, success };
}

/** Row action: op = retry | delete for one log id. */
export async function webhookLogQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const log = await db.webhookLog.findUnique({ where: { id }, include: { webhook: true } });
    if (!log) return { ok: false, error: "Log entry not found." };
    if (op === "delete") { await db.webhookLog.delete({ where: { id } }); revalidatePath("/admin/webhook-logs"); return { ok: true, message: "Deleted." }; }
    if (op === "retry") {
      const r = await redeliver(log);
      revalidatePath("/admin/webhook-logs");
      return r.success ? { ok: true, message: `Delivered (HTTP ${r.status}).` } : { ok: false, error: `Delivery failed${r.status ? ` (HTTP ${r.status})` : ""}.` };
    }
    return { ok: false, error: "Unknown action." };
  });
}

export async function bulkWebhookLogs(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one entry." };
    if (op === "delete") {
      const r = await db.webhookLog.deleteMany({ where: { id: { in: selected } } });
      revalidatePath("/admin/webhook-logs");
      return { ok: true, message: `Deleted ${r.count} entr${r.count === 1 ? "y" : "ies"}.` };
    }
    if (op === "retry") {
      const logs = await db.webhookLog.findMany({ where: { id: { in: selected.slice(0, 50) } }, include: { webhook: true } });
      let ok = 0;
      for (const log of logs) { if ((await redeliver(log)).success) ok++; }
      revalidatePath("/admin/webhook-logs");
      return { ok: true, message: `Retried ${logs.length} deliver${logs.length === 1 ? "y" : "ies"}: ${ok} succeeded, ${logs.length - ok} failed.` };
    }
    return { ok: false, error: "Unknown bulk action." };
  });
}

/** Deactivates every active webhook whose consecutive failure counter reached the threshold (default 5). */
export async function disableFailingWebhooks(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async (admin) => {
    const threshold = Math.max(1, int(fd, "threshold", DEFAULT_FAILURE_THRESHOLD));
    const failing = await db.webhook.findMany({ where: { active: true, failures: { gte: threshold } }, select: { id: true, userId: true, name: true, failures: true } });
    if (!failing.length) return { ok: true, message: `No active webhook has ${threshold}+ consecutive failures.` };
    await db.webhook.updateMany({ where: { id: { in: failing.map((w) => w.id) } }, data: { active: false } });
    for (const w of failing) await logActivity({ userId: w.userId, actorId: admin.id, action: "webhook.disabled", target: "webhook", targetId: w.id, meta: { name: w.name, failures: w.failures, by: "admin" }, isAdmin: true });
    revalidatePath("/admin/webhook-logs");
    return { ok: true, message: `Disabled ${failing.length} failing webhook${failing.length === 1 ? "" : "s"}.` };
  });
}

/** Deletes successful log entries older than 30 days. */
export async function purgeOldWebhookLogs(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const r = await db.webhookLog.deleteMany({ where: { success: true, createdAt: { lt: new Date(Date.now() - 30 * 86400 * 1000) } } });
    revalidatePath("/admin/webhook-logs");
    return { ok: true, message: `Removed ${r.count} old successful entr${r.count === 1 ? "y" : "ies"}.` };
  });
}
