"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, int, bool, list } from "@/lib/admin/query";
import { setSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { appUrl } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const STATUSES = ["open", "pending", "resolved", "closed"], PRIORITIES = ["low", "medium", "high", "urgent"];

export async function replyTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async (admin) => {
    const id = str(fd, "id"), message = str(fd, "message", 50000);
    if (!message) return { ok: false, error: "Reply cannot be empty." };
    const ticket = await db.ticket.findUnique({ where: { id }, include: { user: true } });
    if (!ticket) return { ok: false, error: "Ticket not found." };
    const attachments = list(fd, "attachments");
    await db.ticketReply.create({ data: { ticketId: id, userId: admin.id, message, isStaff: true, attachments: JSON.stringify(attachments) } });
    const status = str(fd, "status");
    await db.ticket.update({ where: { id }, data: { status: STATUSES.includes(status) ? status : "pending", assigneeId: ticket.assigneeId ?? admin.id } });
    const link = appUrl(`/dashboard/tickets/${id}`);
    await sendTemplate("ticket-reply", ticket.user.email, { name: ticket.user.name ?? ticket.user.username, number: String(ticket.number), subject: ticket.subject, link }, ticket.user.language);
    await notify(ticket.userId, `Reply on ticket #${ticket.number}`, ticket.subject, { link: `/dashboard/tickets/${id}` });
    revalidatePath(`/admin/tickets/${id}`); revalidatePath("/admin/tickets");
    return { ok: true, message: "Reply sent." };
  });
}

export async function updateTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const id = str(fd, "id");
    const status = str(fd, "status"), priority = str(fd, "priority");
    await db.ticket.update({ where: { id }, data: { ...(STATUSES.includes(status) ? { status } : {}), ...(PRIORITIES.includes(priority) ? { priority } : {}), assigneeId: optStr(fd, "assigneeId"), categoryId: optStr(fd, "categoryId") } });
    revalidatePath(`/admin/tickets/${id}`); revalidatePath("/admin/tickets");
    return { ok: true, message: "Ticket updated." };
  });
}

export async function deleteTicket(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    await db.ticket.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/tickets");
    return { ok: true, message: "Ticket deleted." };
  });
}

export async function saveSavedReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const id = optStr(fd, "id"), data = { title: str(fd, "title"), content: str(fd, "content", 50000) };
    if (!data.title || !data.content) return { ok: false, error: "Title and content are required." };
    if (id) await db.savedReply.update({ where: { id }, data }); else await db.savedReply.create({ data });
    revalidatePath("/admin/tickets/saved-replies");
    return { ok: true, message: "Saved reply stored." };
  });
}
export async function deleteSavedReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => { await db.savedReply.delete({ where: { id: str(fd, "id") } }); revalidatePath("/admin/tickets/saved-replies"); return { ok: true, message: "Deleted." }; });
}
export async function saveTicketCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const id = optStr(fd, "id"), data = { name: str(fd, "name"), color: str(fd, "color") || "#6366f1", order: int(fd, "order") };
    if (!data.name) return { ok: false, error: "Name is required." };
    if (id) await db.ticketCategory.update({ where: { id }, data }); else await db.ticketCategory.create({ data });
    revalidatePath("/admin/tickets/categories");
    return { ok: true, message: "Category saved." };
  });
}
export async function deleteTicketCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => { await db.ticketCategory.delete({ where: { id: str(fd, "id") } }); revalidatePath("/admin/tickets/categories"); return { ok: true, message: "Deleted." }; });
}
export async function saveHelpdeskSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    await setSettings({
      "helpdesk.enabled": bool(fd, "helpdesk.enabled") ? "1" : "0", "helpdesk.autoAssign": bool(fd, "helpdesk.autoAssign") ? "1" : "0", "helpdesk.autoAssignTo": str(fd, "helpdesk.autoAssignTo"),
      "helpdesk.defaultPriority": PRIORITIES.includes(str(fd, "helpdesk.defaultPriority")) ? str(fd, "helpdesk.defaultPriority") : "low", "helpdesk.allowGuests": bool(fd, "helpdesk.allowGuests") ? "1" : "0",
      "helpdesk.attachments": bool(fd, "helpdesk.attachments") ? "1" : "0", "helpdesk.rating": bool(fd, "helpdesk.rating") ? "1" : "0", "helpdesk.autoCloseDays": String(int(fd, "helpdesk.autoCloseDays", 0)), "helpdesk.notifyAdmins": bool(fd, "helpdesk.notifyAdmins") ? "1" : "0",
    });
    revalidatePath("/admin/tickets/settings");
    return { ok: true, message: "Helpdesk settings saved." };
  });
}
