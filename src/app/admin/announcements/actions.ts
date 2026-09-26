"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool } from "@/lib/admin/query";
import { sendMail } from "@/lib/mail";
import { escapeHtml } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

export async function saveAnnouncement(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("notifications.manage", async () => {
    const id = optStr(fd, "id");
    const data = { title: str(fd, "title"), content: str(fd, "content", 20000), type: ["info", "warning", "success"].includes(str(fd, "type")) ? str(fd, "type") : "info", target: ["all", "users", "guests", "admin"].includes(str(fd, "target")) ? str(fd, "target") : "all", active: bool(fd, "active"), dismissible: bool(fd, "dismissible") };
    if (!data.title || !data.content) return { ok: false, error: "Title and content are required." };
    if (id) await db.announcement.update({ where: { id }, data }); else await db.announcement.create({ data });
    revalidatePath("/admin/announcements"); revalidatePath("/", "layout");
    return { ok: true, message: "Announcement saved." };
  });
}
export async function announcementQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("notifications.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    if (op === "toggle") { const a = await db.announcement.findUnique({ where: { id } }); if (a) await db.announcement.update({ where: { id }, data: { active: !a.active } }); }
    else if (op === "delete") await db.announcement.delete({ where: { id } });
    revalidatePath("/admin/announcements"); revalidatePath("/", "layout");
    return { ok: true, message: "Done." };
  });
}

async function recipients(fd: FormData) {
  let to = str(fd, "to"); // all | admins | plan:<id> | user:<login>
  if (to === "user:" && str(fd, "single")) to = "user:" + str(fd, "single");
  if (to.startsWith("user:")) {
    const login = to.slice(5).trim();
    const u = await db.user.findFirst({ where: { OR: [{ username: login }, { email: login.toLowerCase() }] }, select: { id: true, email: true, username: true, name: true } });
    return u ? [u] : [];
  }
  return db.user.findMany({ where: { status: 1, ...(to.startsWith("plan:") ? { planId: to.slice(5) } : {}), ...(to === "admins" ? { role: "admin" } : {}) }, select: { id: true, email: true, username: true, name: true } });
}

export async function sendNotification(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("notifications.manage", async () => {
    const title = str(fd, "title"), message = str(fd, "message", 5000), link = optStr(fd, "link");
    if (!title || !message) return { ok: false, error: "Title and message are required." };
    const users = await recipients(fd);
    if (!users.length) return { ok: false, error: "No recipients found." };
    await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, title, message, link, type: str(fd, "type") || "info" })) });
    return { ok: true, message: `Notification sent to ${users.length} user(s).` };
  });
}

export async function sendBroadcastEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("notifications.manage", async () => {
    const subject = str(fd, "subject"), body = str(fd, "body", 200000);
    if (!subject || !body) return { ok: false, error: "Subject and body are required." };
    const users = (await recipients(fd)).filter((u) => u.email);
    if (!users.length) return { ok: false, error: "No recipients found." };
    let sent = 0;
    for (const u of users) {
      const html = body.replace(/\{\{\s*username\s*\}\}/g, escapeHtml(u.username)).replace(/\{\{\s*name\s*\}\}/g, escapeHtml(u.name ?? u.username));
      if (await sendMail({ to: u.email, subject, html })) sent++;
    }
    return { ok: true, message: `Email sent to ${sent} of ${users.length} user(s).` };
  });
}
