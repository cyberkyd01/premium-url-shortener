"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markRead(fd: FormData): Promise<void> {
  const u = await requireUser();
  const id = String(fd.get("id") ?? "");
  await db.notification.updateMany({ where: { id, userId: u.id }, data: { read: true } });
  revalidatePath("/dashboard/notifications"); revalidatePath("/dashboard", "layout");
}

export async function markAllRead(): Promise<void> {
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
  revalidatePath("/dashboard/notifications"); revalidatePath("/dashboard", "layout");
}

export async function deleteNotification(fd: FormData): Promise<void> {
  const u = await requireUser();
  const id = String(fd.get("id") ?? "");
  await db.notification.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/dashboard/notifications"); revalidatePath("/dashboard", "layout");
}

export async function deleteAllRead(): Promise<void> {
  const u = await requireUser();
  await db.notification.deleteMany({ where: { userId: u.id, read: true } });
  revalidatePath("/dashboard/notifications");
}
