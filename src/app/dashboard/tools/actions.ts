"use server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { isValidUrl } from "@/lib/utils";
import { testWebhook as sendTestDelivery } from "@/lib/webhooks";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/tools";
const WEBHOOK_EVENTS = ["link.created", "link.clicked", "link.updated", "link.deleted", "bio.viewed", "qr.scanned"] as const;
const PROVIDERS = ["zapier", "custom", "slack", "discord", "telegram", "teams"];
/** Providers whose endpoint is a chat webhook: no HMAC secret is used (Telegram stores the chat id in `secret`). */
const NO_SIGNATURE = ["slack", "discord", "teams"];

async function allowed(userId: string) {
  const { user, features } = await getUserPlan(userId);
  if (user.role !== "admin" && !features.webhooks) return "Your plan does not include webhooks";
  return null;
}

function parse(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const url = String(fd.get("url") ?? "").trim();
  const providerRaw = String(fd.get("provider") ?? "custom");
  const provider = PROVIDERS.includes(providerRaw) ? providerRaw : "custom";
  const events = fd.getAll("events").map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  const secret = String(fd.get("secret") ?? "").trim().slice(0, 120);
  return { name, url, provider, events, secret };
}

/** Provider-specific URL/secret checks; returns an error message or null. */
function validateProvider(d: ReturnType<typeof parse>) {
  if (!isValidUrl(d.url) || !/^https?:/.test(d.url)) return "Enter a valid http(s) URL";
  switch (d.provider) {
    case "slack": return /^https:\/\/hooks\.slack\.com\//.test(d.url) ? null : "Slack URLs look like https://hooks.slack.com/services/...";
    case "discord": return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(d.url) ? null : "Discord URLs look like https://discord.com/api/webhooks/...";
    case "telegram":
      if (!/^https:\/\/api\.telegram\.org\/bot[^/]+\/sendMessage/.test(d.url)) return "Telegram URL must be https://api.telegram.org/bot<TOKEN>/sendMessage";
      if (!/^-?\d{3,20}$/.test(d.secret)) return "Enter your Telegram chat id (a number) in the secret field";
      return null;
    default: return null;
  }
}

function secretFor(d: ReturnType<typeof parse>, existing?: string | null) {
  if (NO_SIGNATURE.includes(d.provider)) return null;
  if (d.provider === "telegram") return d.secret;
  return d.secret || existing || crypto.randomBytes(16).toString("hex");
}

export async function createWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const denied = await allowed(u.id);
  if (denied) return { error: denied };
  const s = await getSettings();
  const d = parse(fd);
  if (d.provider === "zapier" && s["zapier.enabled"] !== "1") return { error: "Zapier integration is disabled" };
  if (!d.name) return { error: "Name is required" };
  const invalid = validateProvider(d);
  if (invalid) return { error: invalid };
  if (!d.events.length) return { error: "Select at least one event" };
  if (u.role !== "admin" && (await db.webhook.count({ where: { userId: u.id } })) >= 20) return { error: "You can create up to 20 webhooks" };
  await db.webhook.create({ data: { userId: u.id, name: d.name, url: d.url, provider: d.provider, events: JSON.stringify(d.events), secret: secretFor(d) } });
  revalidatePath(P);
  return { ok: true, message: "Webhook created" };
}

export async function updateWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const hook = await db.webhook.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!hook) return { error: "Webhook not found" };
  const d = parse(fd);
  if (!d.name) return { error: "Name is required" };
  const invalid = validateProvider(d);
  if (invalid) return { error: invalid };
  if (!d.events.length) return { error: "Select at least one event" };
  await db.webhook.update({ where: { id: hook.id }, data: { name: d.name, url: d.url, provider: d.provider, events: JSON.stringify(d.events), secret: secretFor(d, hook.provider === d.provider ? hook.secret : null), active: fd.get("active") === "1" } });
  revalidatePath(P);
  return { ok: true, message: "Webhook updated" };
}

export async function toggleWebhook(fd: FormData) {
  const u = await requireUser();
  const hook = await db.webhook.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!hook) return;
  await db.webhook.update({ where: { id: hook.id }, data: { active: !hook.active } });
  revalidatePath(P);
}

export async function deleteWebhook(fd: FormData) {
  const u = await requireUser();
  await db.webhook.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  revalidatePath(P);
}

/** Sends a provider-formatted sample payload and records it in the delivery log (/dashboard/webhooks). */
export async function testWebhook(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const hook = await db.webhook.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  if (!hook) return { error: "Webhook not found" };
  const log = await sendTestDelivery(hook.id, u.id);
  revalidatePath(P);
  if (!log) return { error: "Webhook not found" };
  if (log.success) return { ok: true, message: `Delivered (HTTP ${log.status ?? "?"})` };
  return { error: log.status ? `Endpoint responded with HTTP ${log.status}` : `Request failed: ${log.response ?? "network error"}` };
}
