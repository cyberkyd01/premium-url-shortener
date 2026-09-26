"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { retryWebhookLog, testWebhook } from "@/lib/webhooks";
import type { ActionState } from "@/components/ui/form-state";

export async function retryDelivery(logId: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const r = await retryWebhookLog(logId, ws.ownerId);
  if (!r) return { error: "Delivery not found" };
  revalidatePath("/dashboard/webhooks");
  return r.success ? { ok: true, message: `Delivered (HTTP ${r.status})` } : { error: `Delivery failed${r.status ? ` (HTTP ${r.status})` : ""}: ${r.response ?? ""}`.trim() };
}

export async function clearLogs(webhookId?: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const r = await db.webhookLog.deleteMany({ where: { webhook: { userId: ws.ownerId, ...(webhookId ? { id: webhookId } : {}) } } });
  revalidatePath("/dashboard/webhooks");
  return { ok: true, message: `${r.count} log entr${r.count === 1 ? "y" : "ies"} removed` };
}

export async function sendTest(webhookId: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const r = await testWebhook(webhookId, ws.ownerId);
  if (!r) return { error: "Webhook not found" };
  revalidatePath("/dashboard/webhooks");
  return r.success ? { ok: true, message: `Test delivered (HTTP ${r.status})` } : { error: `Test failed${r.status ? ` (HTTP ${r.status})` : ""}: ${r.response ?? ""}`.trim() };
}

export async function reactivateWebhook(webhookId: string): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const hook = await db.webhook.findFirst({ where: { id: webhookId, userId: ws.ownerId } });
  if (!hook) return { error: "Webhook not found" };
  await db.webhook.update({ where: { id: hook.id }, data: { active: true, failures: 0 } });
  revalidatePath("/dashboard/webhooks");
  return { ok: true, message: "Webhook re-enabled" };
}
