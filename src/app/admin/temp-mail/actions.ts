"use server";
import { revalidatePath } from "next/cache";
import { act } from "@/lib/admin/guard";
import { str, int, bool } from "@/lib/admin/query";
import { setSettings, getSetting } from "@/lib/settings";
import { parseDomainList, purgeExpired, TEMPMAIL_PROVIDERS } from "@/lib/tempmail";
import type { ActionState } from "@/components/ui/form-state";

export async function saveTempMailSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const domains = parseDomainList(str(fd, "domains", 20000));
    const provider = str(fd, "provider");
    const ttl = Math.max(5, Math.min(10080, int(fd, "ttl", 60)));
    const secretInput = str(fd, "secret", 500);
    const secret = secretInput || (bool(fd, "keepSecret") ? await getSetting("plugin.tempmail.secret") : "");
    await setSettings({
      "plugin.tempmail.domains": domains.join("\n"),
      "plugin.tempmail.ttl": String(ttl),
      "plugin.tempmail.guests": bool(fd, "guests") ? "1" : "0",
      "plugin.tempmail.provider": TEMPMAIL_PROVIDERS.some((p) => p === provider) ? provider : "generic",
      "plugin.tempmail.secret": secret,
    });
    revalidatePath("/admin/temp-mail"); revalidatePath("/dashboard", "layout"); revalidatePath("/temp-mail");
    return { ok: true, message: domains.length ? `Settings saved. ${domains.length} inbox domain(s) active.` : "Settings saved. Add at least one domain to enable the feature." };
  });
}

export async function purgeTempMail(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const r = await purgeExpired();
    revalidatePath("/admin/temp-mail");
    return { ok: true, message: `Purged ${r.deleted} expired inbox(es).` };
  });
}
