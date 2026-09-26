"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { randomToken } from "@/lib/utils";
import { str } from "@/lib/forms";
import { REPORT_FREQUENCIES, sendDigest, type ReportFrequency } from "@/lib/reports";
import type { ActionState } from "@/components/ui/form-state";

function isFrequency(v: string): v is ReportFrequency { return (REPORT_FREQUENCIES as string[]).includes(v); }

/** Saves User.reportFrequency (none | weekly | monthly) for the logged-in user. */
export async function setReportFrequency(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const frequency = str(fd, "frequency", 10);
  if (!isFrequency(frequency)) return { error: "Invalid frequency" };
  await db.user.update({ where: { id: ws.userId }, data: { reportFrequency: frequency } });
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: frequency === "none" ? "Email reports turned off" : `You will receive a ${frequency} report by email` };
}

/** Emails the current user a digest right away (weekly period). */
export async function sendTestDigest(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const ok = await sendDigest(ws.userId, "weekly");
  return ok ? { ok: true, message: "Digest sent, check your inbox" } : { error: "Could not send the email. Check the mail settings." };
}

/** Creates a public share link for a link, campaign or bio page's analytics. */
export async function createSharedReport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "stats")) return { error: "You do not have permission to share statistics in this team" };
  const kind = str(fd, "kind", 10);
  const targetId = str(fd, "targetId", 64);
  const title = str(fd, "title", 120) || null;
  const password = str(fd, "password", 100);
  const expiresRaw = str(fd, "expiresAt", 40);
  const expiresAt = expiresRaw ? new Date(expiresRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) return { error: "Invalid expiry date" };
  if (!targetId) return { error: "Please select what to share" };
  const data: { linkId?: string; campaignId?: string; bioPageId?: string } = {};
  if (kind === "link") {
    const l = await db.link.findFirst({ where: { id: targetId, userId: ws.ownerId }, select: { id: true } });
    if (!l) return { error: "Link not found" };
    data.linkId = l.id;
  } else if (kind === "campaign") {
    const c = await db.campaign.findFirst({ where: { id: targetId, userId: ws.ownerId }, select: { id: true } });
    if (!c) return { error: "Campaign not found" };
    data.campaignId = c.id;
  } else if (kind === "bio") {
    const b = await db.bioPage.findFirst({ where: { id: targetId, userId: ws.ownerId }, select: { id: true } });
    if (!b) return { error: "Bio page not found" };
    data.bioPageId = b.id;
  } else return { error: "Invalid report type" };
  const report = await db.sharedReport.create({ data: { token: randomToken(16), userId: ws.ownerId, title, password: password ? await bcrypt.hash(password, 8) : null, expiresAt, ...data } });
  revalidatePath("/dashboard/reports");
  return { ok: true, message: "Share link created", data: { token: report.token } };
}

export async function deleteSharedReport(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  const id = str(fd, "id", 64);
  const r = await db.sharedReport.deleteMany({ where: { id, userId: ws.ownerId } });
  if (!r.count) return { error: "Report not found" };
  revalidatePath("/dashboard/reports");
  return { ok: true, message: "Deleted" };
}
