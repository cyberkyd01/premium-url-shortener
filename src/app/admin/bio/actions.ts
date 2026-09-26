"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function bioQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("bio.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const page = await db.bioPage.findUnique({ where: { id } });
    if (!page) return { ok: false, error: "Bio page not found." };
    if (op === "disable") await db.bioPage.update({ where: { id }, data: { status: "disabled" } });
    else if (op === "enable") await db.bioPage.update({ where: { id }, data: { status: "active" } });
    else if (op === "verified") await db.bioPage.update({ where: { id }, data: { verified: !page.verified } });
    else if (op === "delete") await db.bioPage.delete({ where: { id } });
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/bio");
    return { ok: true, message: "Done." };
  });
}

export async function bulkBio(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("bio.manage", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one page." };
    if (op === "disable") await db.bioPage.updateMany({ where: { id: { in: selected } }, data: { status: "disabled" } });
    else if (op === "enable") await db.bioPage.updateMany({ where: { id: { in: selected } }, data: { status: "active" } });
    else if (op === "delete") await db.bioPage.deleteMany({ where: { id: { in: selected } } });
    else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/bio");
    return { ok: true, message: `Applied to ${selected.length} pages.` };
  });
}
