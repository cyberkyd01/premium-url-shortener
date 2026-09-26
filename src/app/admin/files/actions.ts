"use server";
import { revalidatePath } from "next/cache";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function deleteFiles(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const selected = str(fd, "id") ? [str(fd, "id")] : ids(fd);
    if (!selected.length) return { ok: false, error: "Nothing selected." };
    const files = await db.hostedFile.findMany({ where: { id: { in: selected } } });
    for (const f of files) {
      if (f.path.startsWith("/uploads/")) await fs.unlink(path.join(process.cwd(), "public", f.path)).catch(() => {});
      await db.user.update({ where: { id: f.userId }, data: { storageUsed: { decrement: f.size } } }).catch(() => {});
    }
    await db.hostedFile.deleteMany({ where: { id: { in: selected } } });
    revalidatePath("/admin/files");
    return { ok: true, message: `Deleted ${files.length} file(s).` };
  });
}
