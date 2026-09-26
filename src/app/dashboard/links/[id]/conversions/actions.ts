"use server";
import { revalidatePath } from "next/cache";
import { getWorkspace, can } from "@/lib/workspace";
import { deleteConversion } from "@/lib/conversions";
import { str } from "@/lib/forms";
import type { ActionState } from "@/components/ui/form-state";

export async function deleteConversionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ws = await getWorkspace();
  if (!ws) return { error: "Please login" };
  if (!can(ws, "links", "edit")) return { error: "You do not have permission to manage conversions in this team" };
  const id = str(fd, "id", 64);
  const linkId = str(fd, "linkId", 64);
  const ok = await deleteConversion(id, ws.ownerId);
  if (!ok) return { error: "Conversion not found" };
  revalidatePath(`/dashboard/links/${linkId}/conversions`);
  revalidatePath(`/dashboard/links/${linkId}`);
  return { ok: true, message: "Deleted" };
}
