"use server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { withinLimit } from "@/lib/plan";
import { isAliasAvailable } from "@/lib/links";
import { slugify, isValidAlias } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-state";
import { str, bool, color, list } from "@/lib/forms";

const ROTATOR_MODES = ["sequential", "random", "weighted"];

async function guard(action: string) {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "campaigns", action)) return { error: "You do not have permission to manage campaigns" as const };
  return { ws };
}

function revalidate(id?: string) {
  revalidatePath("/dashboard/campaigns");
  if (id) { revalidatePath(`/dashboard/campaigns/${id}`); revalidatePath(`/dashboard/campaigns/${id}/edit`); }
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base) || "campaign";
  const root = slug;
  for (let i = 2; i < 500; i++) {
    const exists = await db.campaign.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!exists) return slug;
    slug = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function parseCampaign(fd: FormData, excludeId?: string) {
  const name = str(fd, "name", 120);
  if (!name) return { error: "Name is required" };
  const rawSlug = str(fd, "slug", 80);
  const slug = rawSlug ? slugify(rawSlug) : slugify(name);
  if (!slug) return { error: "Slug may only contain letters, numbers and dashes" };
  const slugTaken = await db.campaign.findFirst({ where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
  if (slugTaken) return { error: "This slug is already in use. Please choose another." };
  const isRotator = bool(fd, "isRotator");
  let rotatorAlias: string | null = null;
  if (isRotator) {
    rotatorAlias = str(fd, "rotatorAlias", 64);
    if (!rotatorAlias) return { error: "A rotator alias is required when link rotation is enabled" };
    if (!isValidAlias(rotatorAlias)) return { error: "Rotator alias may only contain letters, numbers, dashes and underscores" };
    if (!(await isAliasAvailable(rotatorAlias, null))) return { error: "This rotator alias is already taken by a link, page or user" };
    const clash = await db.campaign.findFirst({ where: { rotatorAlias, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (clash) return { error: "This rotator alias is already used by another campaign" };
  }
  const rotatorMode = str(fd, "rotatorMode", 20);
  return {
    data: {
      name, slug, description: str(fd, "description", 1000) || null, color: color(fd, "color", "#6366f1"),
      isPublic: bool(fd, "isPublic"), isRotator, rotatorAlias, rotatorMode: ROTATOR_MODES.includes(rotatorMode) ? rotatorMode : "sequential",
    },
  };
}

export async function createCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("create");
  if ("error" in g) return { error: g.error };
  const limit = await withinLimit(g.ws.ownerId, "limitCampaigns");
  if (!limit.ok) return { error: limit.limit === 0 ? "Campaigns are not available on your plan. Please upgrade." : `You have reached your plan limit of ${limit.limit} campaigns. Please upgrade.` };
  const parsed = await parseCampaign(fd);
  if ("error" in parsed) return { error: parsed.error };
  if (!str(fd, "slug", 80)) parsed.data.slug = await uniqueSlug(parsed.data.name);
  const c = await db.campaign.create({ data: { ...parsed.data, userId: g.ws.ownerId, teamId: g.ws.teamId } });
  revalidate();
  redirect(`/dashboard/campaigns/${c.id}`);
}

export async function updateCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const existing = await db.campaign.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return { error: "Campaign not found" };
  const parsed = await parseCampaign(fd, id);
  if ("error" in parsed) return { error: parsed.error };
  await db.campaign.update({ where: { id }, data: parsed.data });
  revalidate(id);
  return { ok: true, message: "Campaign saved" };
}

export async function deleteCampaign(fd: FormData) {
  const g = await guard("delete");
  if ("error" in g) return;
  const id = str(fd, "id", 64);
  const existing = await db.campaign.findFirst({ where: { id, userId: g.ws.ownerId } });
  if (!existing) return;
  await db.campaign.delete({ where: { id } }); // links keep working (campaignId set to null)
  revalidate();
  redirect("/dashboard/campaigns");
}

export async function addLinksToCampaign(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard("edit");
  if ("error" in g) return { error: g.error };
  const id = str(fd, "campaignId", 64);
  const ids = list(fd, "linkIds", 64);
  const c = await db.campaign.findFirst({ where: { id, userId: g.ws.ownerId }, select: { id: true } });
  if (!c) return { error: "Campaign not found" };
  if (!ids.length) return { error: "Select at least one link" };
  const r = await db.link.updateMany({ where: { id: { in: ids }, userId: g.ws.ownerId }, data: { campaignId: id } });
  revalidate(id);
  revalidatePath("/dashboard/links");
  return { ok: true, message: `${r.count} link${r.count === 1 ? "" : "s"} added` };
}

export async function removeLinkFromCampaign(fd: FormData) {
  const g = await guard("edit");
  if ("error" in g) return;
  const id = str(fd, "campaignId", 64);
  const linkId = str(fd, "linkId", 64);
  const c = await db.campaign.findFirst({ where: { id, userId: g.ws.ownerId }, select: { id: true } });
  if (!c) return;
  await db.link.updateMany({ where: { id: linkId, campaignId: id, userId: g.ws.ownerId }, data: { campaignId: null } });
  revalidate(id);
  revalidatePath("/dashboard/links");
}
