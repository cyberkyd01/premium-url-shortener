"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function reportQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("reports.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const report = await db.report.findUnique({ where: { id } });
    if (!report) return { ok: false, error: "Report not found." };
    if (op === "resolve") {
      if (bool(fd, "block")) {
        if (report.linkId) await db.link.updateMany({ where: { id: report.linkId }, data: { status: "blocked" } });
        if (report.bioPageId) await db.bioPage.updateMany({ where: { id: report.bioPageId }, data: { status: "disabled" } });
      }
      await db.report.update({ where: { id }, data: { status: "resolved" } });
    } else if (op === "dismiss") await db.report.update({ where: { id }, data: { status: "dismissed" } });
    else if (op === "delete") await db.report.delete({ where: { id } });
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/reports");
    return { ok: true, message: "Done." };
  });
}
