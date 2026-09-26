"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str } from "@/lib/admin/query";
import type { ActionState } from "@/components/ui/form-state";

export async function deleteCampaign(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("campaigns.manage", async () => {
    await db.campaign.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/campaigns");
    return { ok: true, message: "Campaign deleted (links kept)." };
  });
}
