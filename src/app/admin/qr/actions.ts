"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, ids } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function deleteQr(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("qr.manage", async () => {
    const selected = str(fd, "id") ? [str(fd, "id")] : ids(fd);
    if (!selected.length) return { ok: false, error: "Nothing selected." };
    await db.qrCode.deleteMany({ where: { id: { in: selected } } });
    revalidatePath("/admin/qr");
    return { ok: true, message: `Deleted ${selected.length} QR code(s).` };
  });
}
