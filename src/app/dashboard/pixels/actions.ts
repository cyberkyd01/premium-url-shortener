"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { isPixelProvider, validatePixelId } from "@/lib/pixel-providers";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/ui/form-state";
import { str } from "@/lib/forms";

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "pixels", action)) return { error: "You do not have permission to manage pixels" as const };
  const { features, user } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.pixels) return { error: "Retargeting pixels are not available on your plan. Please upgrade." as const };
  return { ws };
}

function parse(fd: FormData) {
  const name = str(fd, "name", 80);
  const provider = str(fd, "provider", 20);
  const pixelId = provider === "custom" ? str(fd, "pixelId", 20000) : str(fd, "pixelId", 300);
  if (!name) return { error: "Name is required" };
  if (!isPixelProvider(provider)) return { error: "Please select a provider" };
  const err = validatePixelId(provider, pixelId);
  if (err) return { error: err };
  return { data: { name, provider, pixelId } };
}

export async function createPixel(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const limit = await withinLimit(g.ws.ownerId, "limitPixels");
  if (!limit.ok) return { error: limit.limit === 0 ? "Pixels are not available on your plan. Please upgrade." : `You have reached your plan limit of ${limit.limit} pixels. Please upgrade.` };
  const p = parse(fd);
  if ("error" in p) return { error: p.error };
  await db.pixel.create({ data: { ...p.data, userId: g.ws.ownerId, teamId: g.ws.teamId } });
  revalidatePath("/dashboard/pixels");
  return { ok: true, message: "Pixel created" };
}

export async function updatePixel(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.pixel.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Pixel not found" };
  const p = parse(fd);
  if ("error" in p) return { error: p.error };
  await db.pixel.update({ where: { id }, data: p.data });
  revalidatePath("/dashboard/pixels");
  return { ok: true, message: "Pixel updated" };
}

export async function deletePixel(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.pixel.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  await db.pixel.delete({ where: { id } }); // LinkPixel rows cascade
  revalidatePath("/dashboard/pixels");
}
