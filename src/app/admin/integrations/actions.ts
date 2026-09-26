"use server";
import { revalidatePath } from "next/cache";
import { act } from "@/lib/admin/guard";
import { str, bool } from "@/lib/admin/query";
import { getSettings, setSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ui/form-state";

const SWITCHES = ["slack.enabled", "zapier.enabled", "social.google", "social.facebook", "social.twitter", "links.webrisk", "links.phishtank"];
const TEXTS = ["slack.clientId", "bio.mailchimpList", "chat.provider", "chat.id", "links.trackingMethod", "links.gaId", "analytics.code"];
const SECRETS = ["slack.clientSecret", "slack.signingSecret", "slack.verificationToken", "bio.mailchimpKey", "bio.giphyKey", "links.webriskKey"];

export async function saveIntegrations(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("integrations.manage", async () => {
    const current = await getSettings();
    const values: Record<string, string> = {};
    for (const k of SWITCHES) if (fd.has(k)) values[k] = bool(fd, k) ? "1" : "0";
    for (const k of TEXTS) if (fd.has(k)) values[k] = str(fd, k, 20000);
    for (const k of SECRETS) if (fd.has(k) && str(fd, k)) values[k] = str(fd, k);
    for (const k of Object.keys(values)) if (values[k] === current[k]) delete values[k];
    if (Object.keys(values).length) await setSettings(values);
    revalidatePath("/admin/integrations"); revalidatePath("/", "layout");
    return { ok: true, message: "Integrations saved." };
  });
}
