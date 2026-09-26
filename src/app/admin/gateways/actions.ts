"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import { json } from "@/lib/utils";
import { GATEWAY_FIELDS } from "@/lib/admin/gateway-meta";
import type { ActionState } from "@/components/ui/form-state";

export async function saveGateway(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("payments.manage", async () => {
    const slug = str(fd, "slug");
    const row = await db.paymentGateway.findUnique({ where: { slug } });
    if (!row) return { ok: false, error: "Gateway not found." };
    const config = json<Record<string, string>>(row.config, {});
    const keys = new Set<string>((GATEWAY_FIELDS[slug] ?? []).map((f) => f.key));
    for (const k of str(fd, "_keys", 2000).split(",").filter(Boolean)) keys.add(k);
    for (const k of keys) {
      const v = fd.get(`c.${k}`);
      if (typeof v !== "string") continue;
      if (v === "" && fd.get(`keep.${k}`) === "1") continue; // secret left blank → keep
      config[k] = v.trim();
    }
    await db.paymentGateway.update({ where: { slug }, data: { enabled: bool(fd, "enabled"), mode: str(fd, "mode") === "live" ? "live" : "sandbox", config: JSON.stringify(config) } });
    revalidatePath("/admin/gateways"); revalidatePath("/pricing");
    return { ok: true, message: `${row.name} saved.` };
  });
}
