"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import { setSettings, getSetting } from "@/lib/settings";
import { cloudflareConfig, provisionHostname, testCloudflare } from "@/lib/cloudflare";
import type { ActionState } from "@/components/ui/form-state";

export async function saveCloudflareSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const token = str(fd, "apiToken", 500) || (bool(fd, "keepToken") ? await getSetting("plugin.cloudflare.apiToken") : "");
    await setSettings({
      "plugin.cloudflare.enabled": bool(fd, "enabled") ? "1" : "0",
      "plugin.cloudflare.zoneId": str(fd, "zoneId", 100),
      "plugin.cloudflare.apiToken": token,
      "plugin.cloudflare.fallbackOrigin": str(fd, "fallbackOrigin", 253).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
    });
    revalidatePath("/admin/cloudflare"); revalidatePath("/admin/domains"); revalidatePath("/dashboard/domains");
    return { ok: true, message: "Cloudflare settings saved." };
  });
}

export async function testCloudflareConnection(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const r = await testCloudflare();
    return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
  });
}

/** Provisions every active user domain that has no Cloudflare hostname yet (or refreshes one by id). */
export async function syncCloudflareHostnames(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("domains.manage", async () => {
    const cfg = await cloudflareConfig();
    if (!cfg.enabled) return { ok: false, error: "Enable and configure Cloudflare first." };
    const id = str(fd, "id");
    const domains = id ? await db.domain.findMany({ where: { id } }) : await db.domain.findMany({ where: { userId: { not: null }, status: 1, OR: [{ cfHostnameId: null }, { cfStatus: { not: "active" } }, { cfSslStatus: { not: "active" } }] }, take: 50 });
    let ok = 0, failed = 0;
    for (const d of domains) { const r = await provisionHostname(d); if (r.ok) ok++; else failed++; }
    revalidatePath("/admin/cloudflare"); revalidatePath("/admin/domains"); revalidatePath("/dashboard/domains");
    return { ok: true, message: `Synced ${ok} hostname(s)${failed ? `, ${failed} failed` : ""}.` };
  });
}
