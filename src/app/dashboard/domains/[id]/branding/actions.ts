"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { saveDomainBranding } from "@/lib/whitelabel";
import { logActivity } from "@/lib/activity";
import { clientIp } from "@/lib/geo";
import type { ActionState } from "@/components/ui/form-state";

/** Saves Domain.branding for a domain the workspace owner owns (feature: customLogo). */
export async function saveBranding(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "domains", "edit")) return { error: "You do not have permission to edit domains" };
  const { user, features } = await getUserPlan(ws.ownerId);
  if (user.role !== "admin" && !features.customLogo) return { error: "White-label branding is not included in your plan. Please upgrade." };
  const id = String(fd.get("id") ?? "");
  const input = {
    name: fd.get("name"), logo: fd.get("logo"), favicon: fd.get("favicon"),
    primary: fd.get("primaryClear") === "1" ? "" : fd.get("primary"), accent: fd.get("accentClear") === "1" ? "" : fd.get("accent"),
    hideBranding: fd.get("hideBranding"), loginTitle: fd.get("loginTitle"),
  };
  const saved = await saveDomainBranding(id, ws.ownerId, input);
  if (!saved) return { error: "Domain not found" };
  await logActivity({ userId: ws.ownerId, actorId: ws.userId, action: "domain.branding", target: "domain", targetId: id, meta: { name: saved.name, hideBranding: saved.hideBranding }, ip: clientIp(await headers()) });
  revalidatePath(`/dashboard/domains/${id}/branding`); revalidatePath("/dashboard/domains");
  return { ok: true, message: "Branding saved" };
}
