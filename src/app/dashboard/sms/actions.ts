"use server";
import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";
import { createLink, shortUrl, LinkError } from "@/lib/links";
import { sendSms, isE164, normalizePhone, extractUrls } from "@/lib/sms";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/sms";

export async function saveTwilioSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const sid = String(fd.get("sid") ?? "").trim();
  const token = String(fd.get("token") ?? "").trim();
  const from = String(fd.get("from") ?? "").trim();
  if (sid && !/^AC[0-9a-f]{32}$/i.test(sid)) return { error: "Account SID should start with AC followed by 32 characters" };
  if (from && !isE164(from) && !/^MG[0-9a-f]{32}$/i.test(from)) return { error: "Sender must be an E.164 number (+1...) or a Messaging Service SID (MG...)" };
  const me = await db.user.findUnique({ where: { id: u.id }, select: { twilioToken: true } });
  await db.user.update({ where: { id: u.id }, data: { twilioSid: sid || null, twilioToken: token ? token : me?.twilioToken ?? null, twilioFrom: from || null } });
  revalidatePath(P);
  return { ok: true, message: "Twilio settings saved" };
}

export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  const name = String(fd.get("name") ?? "").trim().slice(0, 80) || null;
  if (!isE164(phone)) return { error: "Phone must be in E.164 format, e.g. +14155552671" };
  if (await db.smsContact.findFirst({ where: { userId: u.id, phone } })) return { error: "This contact already exists" };
  await db.smsContact.create({ data: { userId: u.id, phone, name } });
  revalidatePath(P);
  return { ok: true, message: "Contact added" };
}

export async function importContacts(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file" };
  if (file.size > 1_000_000) return { error: "CSV is too large (max 1 MB)" };
  const text = await file.text();
  let rows: string[][];
  try { rows = parse(text, { skip_empty_lines: true, relax_column_count: true, trim: true }) as string[][]; } catch { return { error: "Could not parse the CSV" }; }
  const existing = new Set((await db.smsContact.findMany({ where: { userId: u.id }, select: { phone: true } })).map((c) => c.phone));
  const data: { userId: string; phone: string; name: string | null }[] = [];
  let skipped = 0;
  for (const r of rows) {
    const cells = r.map((c) => String(c ?? ""));
    const phoneCell = cells.find((c) => /^\+?[\d\s()-]{7,}$/.test(c));
    if (!phoneCell) { skipped++; continue; }
    const phone = normalizePhone(phoneCell);
    if (!isE164(phone) || existing.has(phone)) { skipped++; continue; }
    existing.add(phone);
    const name = cells.find((c) => c !== phoneCell && c && !/^\+?[\d\s()-]+$/.test(c)) ?? null;
    data.push({ userId: u.id, phone, name: name ? name.slice(0, 80) : null });
    if (data.length >= 2000) break;
  }
  if (data.length) await db.smsContact.createMany({ data });
  revalidatePath(P);
  return { ok: true, message: `Imported ${data.length} contacts${skipped ? `, skipped ${skipped}` : ""}` };
}

export async function deleteContact(fd: FormData) {
  const u = await requireUser();
  await db.smsContact.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  revalidatePath(P);
}

export async function sendMessages(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const { user, plan } = await getUserPlan(u.id);
  if (!user.twilioSid || !user.twilioToken || !user.twilioFrom) return { error: "Configure your Twilio credentials first" };
  const raw = String(fd.get("to") ?? "");
  const contactIds = fd.getAll("contacts").map(String);
  const numbers = new Set<string>();
  for (const part of raw.split(/[\n,;]+/)) { const n = normalizePhone(part); if (n) numbers.add(n); }
  if (contactIds.length) for (const c of await db.smsContact.findMany({ where: { userId: u.id, id: { in: contactIds } } })) numbers.add(c.phone);
  const bad = [...numbers].filter((n) => !isE164(n));
  if (bad.length) return { error: `Invalid numbers (use E.164 format): ${bad.slice(0, 5).join(", ")}` };
  if (numbers.size === 0) return { error: "Add at least one recipient" };
  let body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Message cannot be empty" };
  if (body.length > 1600) return { error: "Message is too long (max 1600 characters)" };
  if (user.role !== "admin") {
    const limit = plan?.limitSms ?? 0;
    if (limit === 0) return { error: "Your plan does not include SMS sending" };
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const used = await db.smsMessage.count({ where: { userId: u.id, createdAt: { gte: monthStart } } });
    if (limit !== -1 && used + numbers.size > limit) return { error: `Sending ${numbers.size} messages would exceed your monthly limit of ${limit} (${used} used)` };
  }
  // Auto-shorten URLs in the body
  if (fd.get("shorten") !== "0") {
    for (const url of extractUrls(body)) {
      try {
        const link = await createLink(u.id, { url, notes: "Created from SMS" });
        body = body.split(url).join(shortUrl(link));
      } catch (e) { if (e instanceof LinkError) return { error: `Could not shorten ${url}: ${e.message}` }; }
    }
  }
  let sent = 0, failed = 0;
  for (const to of numbers) {
    const r = await sendSms({ sid: user.twilioSid, token: user.twilioToken, from: user.twilioFrom }, to, body);
    await db.smsMessage.create({ data: { userId: u.id, to, body, status: r.ok ? r.status : "failed", sid: r.ok ? r.sid : null, error: r.ok ? null : r.error } });
    if (r.ok) sent++; else failed++;
  }
  revalidatePath(P);
  return { ok: failed === 0, message: `Sent ${sent} message${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed (see history)` : ""}`, ...(sent === 0 && failed ? { error: "All messages failed. Check your Twilio credentials and the history for details." } : {}) };
}
