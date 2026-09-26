"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

/** Row action: op = delete for one migration job. */
export async function migrationQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const job = await db.migrationJob.findUnique({ where: { id }, select: { id: true } });
    if (!job) return { ok: false, error: "Migration job not found." };
    if (op === "delete") await db.migrationJob.delete({ where: { id } });
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/migrations");
    return { ok: true, message: "Migration job deleted. Imported links were kept." };
  });
}

export async function bulkMigrations(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one job." };
    if (op === "delete") await db.migrationJob.deleteMany({ where: { id: { in: selected } } });
    else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/migrations");
    return { ok: true, message: `Deleted ${selected.length} job${selected.length === 1 ? "" : "s"}.` };
  });
}

/** Removes finished jobs older than 90 days (their links stay). */
export async function purgeOldMigrations(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const r = await db.migrationJob.deleteMany({ where: { status: { in: ["done", "partial", "failed"] }, createdAt: { lt: new Date(Date.now() - 90 * 86400 * 1000) } } });
    revalidatePath("/admin/migrations");
    return { ok: true, message: `Removed ${r.count} old job${r.count === 1 ? "" : "s"}.` };
  });
}
