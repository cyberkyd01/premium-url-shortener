"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, num, bool } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function saveTax(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    const id = optStr(fd, "id");
    const data = { name: str(fd, "name"), country: (str(fd, "country") || "*").toUpperCase(), state: optStr(fd, "state"), rate: num(fd, "rate"), active: bool(fd, "active") };
    if (!data.name) return { ok: false, error: "Name is required." };
    if (id) await db.taxRate.update({ where: { id }, data }); else await db.taxRate.create({ data });
    revalidatePath("/admin/taxes");
    return { ok: true, message: "Tax rate saved." };
  });
}
export async function deleteTax(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plans.manage", async () => {
    await db.taxRate.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/taxes");
    return { ok: true, message: "Deleted." };
  });
}
