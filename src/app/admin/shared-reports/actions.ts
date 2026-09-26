"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

/** Row action: op = delete | unprotect | expire for one shared report. */
export async function sharedReportQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const report = await db.sharedReport.findUnique({ where: { id }, select: { id: true } });
    if (!report) return { ok: false, error: "Shared report not found." };
    if (op === "delete") await db.sharedReport.delete({ where: { id } });
    else if (op === "expire") await db.sharedReport.update({ where: { id }, data: { expiresAt: new Date() } });
    else if (op === "unprotect") await db.sharedReport.update({ where: { id }, data: { password: null } });
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/shared-reports");
    return { ok: true, message: op === "delete" ? "Shared report deleted." : op === "expire" ? "Link expired." : "Password removed." };
  });
}

export async function bulkSharedReports(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one report." };
    if (op === "delete") await db.sharedReport.deleteMany({ where: { id: { in: selected } } });
    else if (op === "expire") await db.sharedReport.updateMany({ where: { id: { in: selected } }, data: { expiresAt: new Date() } });
    else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/shared-reports");
    return { ok: true, message: `Applied to ${selected.length} report${selected.length === 1 ? "" : "s"}.` };
  });
}

/** Removes every shared report whose expiry date has passed. */
export async function purgeExpiredReports(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("dashboard.view", async () => {
    const r = await db.sharedReport.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    revalidatePath("/admin/shared-reports");
    return { ok: true, message: `Removed ${r.count} expired report${r.count === 1 ? "" : "s"}.` };
  });
}
