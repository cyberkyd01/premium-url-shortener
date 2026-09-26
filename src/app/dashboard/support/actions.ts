"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendTemplate } from "@/lib/mail";
import { notify, notifyAdmins } from "@/lib/notify";
import { appUrl, json } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const P = "/dashboard/support";
const PRIORITIES = ["low", "medium", "high", "urgent"];

function attachments(fd: FormData) {
  const list = json<unknown>(String(fd.get("attachments") ?? "[]"), []);
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && /^(\/|https?:\/\/)/.test(x)).slice(0, 10) : [];
}

async function ownTicket(userId: string, id: string, role: string) {
  const t = await db.ticket.findUnique({ where: { id } });
  if (!t) return null;
  if (t.userId !== userId && role !== "admin") return null;
  return t;
}

export async function createTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 150);
  const message = String(fd.get("message") ?? "").trim().slice(0, 10000);
  const priorityRaw = String(fd.get("priority") ?? "low");
  const priority = PRIORITIES.includes(priorityRaw) ? priorityRaw : "low";
  const categoryId = String(fd.get("categoryId") ?? "") || null;
  if (subject.length < 3) return { error: "Subject is too short" };
  if (message.length < 10) return { error: "Please describe your issue (at least 10 characters)" };
  if (categoryId && !(await db.ticketCategory.findUnique({ where: { id: categoryId } }))) return { error: "Invalid category" };
  const open = await db.ticket.count({ where: { userId: u.id, status: { in: ["open", "pending"] } } });
  if (open >= 10) return { error: "You have too many open tickets. Please wait for a reply." };
  const last = await db.ticket.aggregate({ _max: { number: true } });
  const number = (last._max.number ?? 0) + 1;
  const ticket = await db.ticket.create({ data: { number, userId: u.id, subject, priority, categoryId, replies: { create: { userId: u.id, message, attachments: JSON.stringify(attachments(fd)) } } } });
  await notifyAdmins(`New ticket #${number}`, `${u.username}: ${subject}`, `/admin/tickets/${ticket.id}`);
  revalidatePath(P);
  redirect(`${P}/${ticket.id}`);
}

export async function replyTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const t = await ownTicket(u.id, String(fd.get("ticketId") ?? ""), u.role);
  if (!t) return { error: "Ticket not found" };
  if (t.status === "closed") return { error: "This ticket is closed. Reopen it to reply." };
  const message = String(fd.get("message") ?? "").trim().slice(0, 10000);
  if (!message) return { error: "Message cannot be empty" };
  const isStaff = u.role === "admin" && t.userId !== u.id;
  await db.$transaction([
    db.ticketReply.create({ data: { ticketId: t.id, userId: u.id, message, attachments: JSON.stringify(attachments(fd)), isStaff } }),
    db.ticket.update({ where: { id: t.id }, data: { status: isStaff ? "pending" : "open" } }),
  ]);
  if (isStaff) {
    const owner = await db.user.findUnique({ where: { id: t.userId } });
    if (owner) {
      if (owner.notifyEmail) await sendTemplate("ticket-reply", owner.email, { name: owner.name ?? owner.username, number: String(t.number), subject: t.subject, link: appUrl(`${P}/${t.id}`) }, owner.language);
      await notify(owner.id, `Reply on ticket #${t.number}`, t.subject, { link: `${P}/${t.id}` });
    }
  } else {
    await notifyAdmins(`Reply on ticket #${t.number}`, `${u.username} replied: ${t.subject}`, `/admin/tickets/${t.id}`);
  }
  revalidatePath(`${P}/${t.id}`);
  return { ok: true, message: "Reply sent" };
}

export async function setTicketStatus(fd: FormData) {
  const u = await requireUser();
  const t = await ownTicket(u.id, String(fd.get("ticketId") ?? ""), u.role);
  if (!t) return;
  const status = String(fd.get("status") ?? "") === "closed" ? "closed" : "open";
  await db.ticket.update({ where: { id: t.id }, data: { status } });
  revalidatePath(P);
  revalidatePath(`${P}/${t.id}`);
}

export async function rateTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const t = await ownTicket(u.id, String(fd.get("ticketId") ?? ""), u.role);
  if (!t) return { error: "Ticket not found" };
  if (!["resolved", "closed"].includes(t.status)) return { error: "You can rate a ticket once it is resolved or closed" };
  const rating = parseInt(String(fd.get("rating") ?? "0"), 10);
  if (rating < 1 || rating > 5) return { error: "Choose 1 to 5 stars" };
  await db.ticket.update({ where: { id: t.id }, data: { rating, ratingComment: String(fd.get("comment") ?? "").trim().slice(0, 500) || null } });
  revalidatePath(`${P}/${t.id}`);
  return { ok: true, message: "Thanks for your feedback!" };
}
