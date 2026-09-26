import { db } from "./db";

export async function notify(userId: string | null, title: string, message: string, opts: { type?: string; link?: string } = {}) {
  return db.notification.create({ data: { userId, title, message, type: opts.type ?? "info", link: opts.link } });
}
export async function notifyAdmins(title: string, message: string, link?: string) {
  const admins = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
  await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title, message, link, type: "info" })) });
}
