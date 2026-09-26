"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import { checkLink, runHealthChecks } from "@/lib/health";
import type { ActionState } from "@/components/ui/form-state";

const CHECK_SELECT = { id: true, url: true, alias: true, userId: true, healthStatus: true, fallbackUrl: true, title: true } as const;

async function applyOp(op: string, linkIds: string[]): Promise<string> {
  if (op === "check") {
    const links = await db.link.findMany({ where: { id: { in: linkIds } }, select: CHECK_SELECT });
    let ok = 0, broken = 0;
    for (const l of links) { const r = await checkLink(l); if (r.ok) ok++; else broken++; }
    return `Checked ${links.length} link${links.length === 1 ? "" : "s"}: ${ok} healthy, ${broken} broken.`;
  }
  if (op === "disable") { const r = await db.link.updateMany({ where: { id: { in: linkIds } }, data: { status: "disabled" } }); return `Disabled ${r.count} link${r.count === 1 ? "" : "s"}.`; }
  if (op === "enable") { const r = await db.link.updateMany({ where: { id: { in: linkIds } }, data: { status: "active" } }); return `Enabled ${r.count} link${r.count === 1 ? "" : "s"}.`; }
  if (op === "reset") { const r = await db.link.updateMany({ where: { id: { in: linkIds } }, data: { healthStatus: "unknown", healthCode: null, healthCheckedAt: null } }); return `Reset ${r.count} link${r.count === 1 ? "" : "s"} to unchecked.`; }
  throw new Error("Unknown action.");
}

/** Row action: op = check | disable | enable | reset for one link id. */
export async function healthQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const link = await db.link.findUnique({ where: { id }, select: { id: true } });
    if (!link) return { ok: false, error: "Link not found." };
    const message = await applyOp(op, [id]);
    revalidatePath("/admin/health"); revalidatePath(`/admin/links/${id}`);
    return { ok: true, message };
  });
}

export async function bulkHealth(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("links.manage", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one link." };
    const message = await applyOp(op, selected.slice(0, 100));
    revalidatePath("/admin/health");
    return { ok: true, message };
  });
}

/** Checks the 100 least-recently-checked active links across the platform. */
export async function runHealthBatch(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("links.manage", async () => {
    const r = await runHealthChecks(100);
    revalidatePath("/admin/health");
    return { ok: true, message: `Checked ${r.checked} links: ${r.ok} healthy, ${r.broken} broken (${r.newlyBroken} newly broken).` };
  });
}
