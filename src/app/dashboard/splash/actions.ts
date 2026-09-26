"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-state";
import { str, strOrNull, bool, int, color, isImageRef } from "@/lib/forms";

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "splash", action)) return { error: "You do not have permission to manage splash pages" as const };
  const { features, user } = await getUserPlan(ws.ownerId);
  const isAdmin = user.role === "admin";
  if (!isAdmin && !features.customSplash) return { error: "Custom splash pages are not available on your plan. Please upgrade." as const };
  return { ws, features, isAdmin };
}

function revalidate(id?: string) {
  revalidatePath("/dashboard/splash");
  if (id) revalidatePath(`/dashboard/splash/${id}`);
}

function parse(fd: FormData, allowCss: boolean) {
  const name = str(fd, "name", 80);
  if (!name) return { error: "Name is required" };
  const logo = str(fd, "logo", 1000);
  const image = str(fd, "image", 1000);
  if (logo && !isImageRef(logo)) return { error: "Logo must be an uploaded file or a valid URL" };
  if (image && !isImageRef(image)) return { error: "Image must be an uploaded file or a valid URL" };
  return {
    data: {
      name,
      title: strOrNull(fd, "title", 200),
      description: strOrNull(fd, "description", 2000),
      logo: logo || null,
      image: image || null,
      buttonText: str(fd, "buttonText", 60) || "Continue",
      buttonColor: color(fd, "buttonColor", "#6366f1"),
      bgColor: color(fd, "bgColor", "#ffffff"),
      textColor: color(fd, "textColor", "#111827"),
      countdown: int(fd, "countdown", 5, 0, 60),
      showAds: bool(fd, "showAds"),
      adCode: strOrNull(fd, "adCode", 10000),
      customCss: allowCss ? strOrNull(fd, "customCss", 20000) : null,
      customHtml: strOrNull(fd, "customHtml", 20000),
      isDefault: bool(fd, "isDefault"),
    },
  };
}

export async function createSplash(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const limit = await withinLimit(g.ws.ownerId, "limitSplash");
  if (!limit.ok) return { error: limit.limit === 0 ? "Splash pages are not available on your plan. Please upgrade." : `You have reached your plan limit of ${limit.limit} splash pages. Please upgrade.` };
  const p = parse(fd, g.isAdmin || g.features.customCss);
  if ("error" in p) return { error: p.error };
  if (p.data.isDefault) await db.splashPage.updateMany({ where: { userId: g.ws.ownerId }, data: { isDefault: false } });
  const s = await db.splashPage.create({ data: { ...p.data, userId: g.ws.ownerId, teamId: g.ws.teamId } });
  revalidate();
  redirect(`/dashboard/splash/${s.id}?created=1`);
}

export async function updateSplash(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.splashPage.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Splash page not found" };
  const p = parse(fd, g.isAdmin || g.features.customCss);
  if ("error" in p) return { error: p.error };
  if (!(g.isAdmin || g.features.customCss)) p.data.customCss = existing.customCss;
  if (p.data.isDefault) await db.splashPage.updateMany({ where: { userId: g.ws.ownerId, NOT: { id } }, data: { isDefault: false } });
  await db.splashPage.update({ where: { id }, data: p.data });
  revalidate(id);
  return { ok: true, message: "Splash page saved" };
}

export async function setDefaultSplash(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.splashPage.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  await db.$transaction([
    db.splashPage.updateMany({ where: { userId: g.ws.ownerId }, data: { isDefault: false } }),
    db.splashPage.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidate(id);
}

export async function deleteSplash(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.splashPage.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  await db.splashPage.delete({ where: { id } }); // links fall back to the default splash (splashId → null)
  revalidate();
  if (str(fd, "redirect", 2) === "1") redirect("/dashboard/splash");
}
