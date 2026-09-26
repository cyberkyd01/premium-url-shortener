"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { OVERLAY_TYPES, OVERLAY_POSITIONS, type OverlayOptions } from "@/components/overlays/overlay-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-state";
import { str, strOrNull, bool, int, color, list, isHttpUrl, isImageRef } from "@/lib/forms";

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "overlays", action)) return { error: "You do not have permission to manage overlays" as const };
  const { features, user } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.overlays) return { error: "Overlays are not available on your plan. Please upgrade." as const };
  return { ws };
}

function revalidate(id?: string) {
  revalidatePath("/dashboard/overlays");
  if (id) { revalidatePath(`/dashboard/overlays/${id}`); revalidatePath(`/dashboard/overlays/${id}/responses`); }
}

const FORM_FIELDS = ["name", "email", "message"] as const;

function parse(fd: FormData) {
  const name = str(fd, "name", 80);
  if (!name) return { error: "Name is required" };
  const type = str(fd, "type", 20);
  if (!OVERLAY_TYPES.some((t) => t.key === type)) return { error: "Please select an overlay type" };
  const position = str(fd, "position", 20);
  if (!OVERLAY_POSITIONS.some((p) => p.key === position)) return { error: "Please select a position" };
  const buttonUrl = str(fd, "buttonUrl", 1000);
  if (buttonUrl && !isHttpUrl(buttonUrl)) return { error: "Button URL must be a valid http(s) URL" };
  const image = str(fd, "image", 1000);
  if (image && !isImageRef(image)) return { error: "Image must be an uploaded file or a valid URL" };
  const video = str(fd, "video", 1000);
  if (video && !isHttpUrl(video)) return { error: "Video must be a valid http(s) URL" };
  const pollOptions = list(fd, "pollOptions", 100).slice(0, 10);
  if (type === "poll" && pollOptions.length < 2) return { error: "A poll needs at least two options" };
  if (type === "video" && !video) return { error: "Please enter a video URL" };
  if (type === "image" && !image) return { error: "Please upload an image" };
  const couponCode = str(fd, "couponCode", 40);
  if (type === "coupon" && !couponCode) return { error: "Please enter the coupon code" };
  const formFields = list(fd, "formFields", 10).filter((f): f is (typeof FORM_FIELDS)[number] => (FORM_FIELDS as readonly string[]).includes(f));
  const options: OverlayOptions = {
    pollOptions, couponCode: couponCode || undefined, formFields: formFields.length ? formFields : undefined,
    successMessage: str(fd, "successMessage", 200) || undefined, buttonNewTab: bool(fd, "buttonNewTab"), showClose: bool(fd, "showClose"),
  };
  return {
    data: {
      name, type, position,
      title: strOrNull(fd, "title", 200), message: strOrNull(fd, "message", 2000),
      buttonText: strOrNull(fd, "buttonText", 60), buttonUrl: buttonUrl || null, image: image || null, video: video || null,
      options: JSON.stringify(options),
      bgColor: color(fd, "bgColor", "#ffffff"), textColor: color(fd, "textColor", "#111827"), accentColor: color(fd, "accentColor", "#6366f1"),
      delay: int(fd, "delay", 2, 0, 120), disclaimer: strOrNull(fd, "disclaimer", 500),
    },
  };
}

export async function createOverlay(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const limit = await withinLimit(g.ws.ownerId, "limitOverlays");
  if (!limit.ok) return { error: limit.limit === 0 ? "Overlays are not available on your plan. Please upgrade." : `You have reached your plan limit of ${limit.limit} overlays. Please upgrade.` };
  const p = parse(fd);
  if ("error" in p) return { error: p.error };
  const o = await db.overlay.create({ data: { ...p.data, userId: g.ws.ownerId, teamId: g.ws.teamId } });
  revalidate();
  redirect(`/dashboard/overlays/${o.id}?created=1`);
}

export async function updateOverlay(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.overlay.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Overlay not found" };
  const p = parse(fd);
  if ("error" in p) return { error: p.error };
  await db.overlay.update({ where: { id }, data: p.data });
  revalidate(id);
  return { ok: true, message: "Overlay saved" };
}

export async function deleteOverlay(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.overlay.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  await db.overlay.delete({ where: { id } }); // responses cascade, links fall back (overlayId → null)
  revalidate();
  if (str(fd, "redirect", 2) === "1") redirect("/dashboard/overlays");
}

export async function deleteOverlayResponse(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const r = await db.overlayResponse.findFirst({ where: { id, overlay: { userId: g.ws.ownerId } }, select: { overlayId: true } });
  if (!r) return;
  await db.overlayResponse.delete({ where: { id } });
  revalidate(r.overlayId);
}

export async function clearOverlayResponses(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const overlayId = str(fd, "overlayId", 64);
  const o = await db.overlay.findFirst({ where: { id: overlayId, userId: g.ws.ownerId }, select: { id: true } });
  if (!o) return;
  await db.overlayResponse.deleteMany({ where: { overlayId } });
  revalidate(overlayId);
}
