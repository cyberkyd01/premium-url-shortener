"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-state";
import { str, bool, color } from "@/lib/forms";

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "campaigns", action)) return { error: "You do not have permission to manage channels" as const };
  return { ws };
}

function revalidate(id?: string) {
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard", "layout");
  if (id) revalidatePath(`/dashboard/channels/${id}`);
}

export async function createChannel(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const name = str(fd, "name", 80);
  if (!name) return { error: "Name is required" };
  // limitChannels is not part of withinLimit's LimitKey, so count manually (admins bypass).
  const plan = await db.user.findUnique({ where: { id: g.ws.ownerId }, select: { role: true, plan: { select: { limitChannels: true } } } });
  const max = plan?.plan?.limitChannels ?? -1;
  if (plan?.role !== "admin" && max !== -1) {
    const used = await db.channel.count({ where: { userId: g.ws.ownerId } });
    if (used >= max) return { error: `You have reached your plan limit of ${max} channels. Please upgrade.` };
  }
  await db.channel.create({ data: { name, color: color(fd, "color", "#6366f1"), starred: bool(fd, "starred"), userId: g.ws.ownerId, teamId: g.ws.teamId } });
  revalidate();
  return { ok: true, message: "Channel created" };
}

export async function updateChannel(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const name = str(fd, "name", 80);
  if (!name) return { error: "Name is required" };
  const ch = await db.channel.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!ch) return { error: "Channel not found" };
  await db.channel.update({ where: { id }, data: { name, color: color(fd, "color", ch.color), starred: bool(fd, "starred") } });
  revalidate(id);
  return { ok: true, message: "Channel updated" };
}

export async function toggleStar(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const ch = await db.channel.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!ch) return;
  await db.channel.update({ where: { id }, data: { starred: !ch.starred } });
  revalidate(id);
}

export async function deleteChannel(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const ch = await db.channel.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!ch) return;
  // Items are unassigned (onDelete: SetNull) — nothing else is removed.
  await db.channel.delete({ where: { id } });
  revalidate();
  if (str(fd, "redirect", 10) === "1") redirect("/dashboard/channels");
}

/** Removes a link / QR code / bio page from a channel (does not delete the item). */
export async function removeFromChannel(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const channelId = str(fd, "channelId", 64);
  const kind = str(fd, "kind", 10);
  const itemId = str(fd, "itemId", 64);
  const ch = await db.channel.findFirst({ where: { id: channelId, userId: g.ws.ownerId } });
  if (!ch) return;
  if (kind === "link") await db.link.updateMany({ where: { id: itemId, channelId, userId: g.ws.ownerId }, data: { channelId: null } });
  else if (kind === "qr") await db.qrCode.updateMany({ where: { id: itemId, channelId, userId: g.ws.ownerId }, data: { channelId: null } });
  else if (kind === "bio") await db.bioPage.updateMany({ where: { id: itemId, channelId, userId: g.ws.ownerId }, data: { channelId: null } });
  revalidate(channelId);
}
