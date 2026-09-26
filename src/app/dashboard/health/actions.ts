"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { checkLink, runHealthChecks } from "@/lib/health";
import { str } from "@/lib/forms";
import type { ActionState } from "@/components/ui/form-state";

async function guard() {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" as const };
  if (!can(ws, "links", "stats")) return { error: "You do not have permission to view link health in this team" as const };
  return { ws };
}

/** Checks a single link owned by the workspace right now. */
export async function checkLinkNow(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const id = str(fd, "id", 64);
  const link = await db.link.findFirst({ where: { id, userId: g.ws.ownerId }, select: { id: true, url: true, alias: true, userId: true, healthStatus: true, fallbackUrl: true, title: true } });
  if (!link) return { error: "Link not found" };
  const r = await checkLink(link);
  revalidatePath("/dashboard/health");
  revalidatePath(`/dashboard/links/${id}`);
  return { ok: true, message: r.ok ? `Healthy (HTTP ${r.status ?? "n/a"}, ${r.latencyMs}ms)` : `Broken: ${r.error ?? "HTTP " + r.status}` };
}

/** Checks up to 50 of the workspace's least-recently-checked links. */
export async function checkAllLinks(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const r = await runHealthChecks(50, { userId: g.ws.ownerId });
  revalidatePath("/dashboard/health");
  return { ok: true, message: `Checked ${r.checked} links: ${r.ok} healthy, ${r.broken} broken${r.newlyBroken ? ` (${r.newlyBroken} newly broken)` : ""}` };
}
