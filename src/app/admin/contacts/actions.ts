"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function contactQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const selected = str(fd, "id") ? [str(fd, "id")] : ids(fd), op = str(fd, "op") || str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Nothing selected." };
    if (op === "read") await db.contact.updateMany({ where: { id: { in: selected } }, data: { read: true } });
    else if (op === "unread") await db.contact.updateMany({ where: { id: { in: selected } }, data: { read: false } });
    else if (op === "delete") await db.contact.deleteMany({ where: { id: { in: selected } } });
    else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/contacts");
    return { ok: true, message: "Done." };
  });
}
