"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import { setSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ui/form-state";

const AD_SLOTS = ["header", "footer", "sidebar", "splash-top", "splash-bottom", "bio", "frame"] as const;
const SETTING_KEY: Record<string, string> = { header: "ads.header", footer: "ads.footer", sidebar: "ads.sidebar", "splash-top": "ads.splashTop", "splash-bottom": "ads.splashBottom", bio: "ads.bio", frame: "ads.frame" };

/** Saves every slot as an Ad row and mirrors the code into settings ads.* so the frontend can read either. */
export async function saveAds(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("ads.manage", async () => {
    const settings: Record<string, string> = { "ads.enabled": bool(fd, "ads.enabled") ? "1" : "0", "ads.hideForPremium": bool(fd, "ads.hideForPremium") ? "1" : "0" };
    for (const slot of AD_SLOTS) {
      const code = str(fd, `slot.${slot}`, 100000), active = bool(fd, `active.${slot}`);
      const existing = await db.ad.findFirst({ where: { slot } });
      if (existing) await db.ad.update({ where: { id: existing.id }, data: { code, active, name: slot } });
      else if (code) await db.ad.create({ data: { slot, code, active, name: slot } });
      settings[SETTING_KEY[slot]] = active ? code : "";
    }
    await setSettings(settings);
    revalidatePath("/admin/ads"); revalidatePath("/", "layout");
    return { ok: true, message: "Advertisements saved." };
  });
}
