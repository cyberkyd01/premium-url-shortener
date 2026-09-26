"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { act } from "@/lib/admin/guard";
import { str } from "@/lib/admin/query";
import { getSettings, setSettings } from "@/lib/settings";
import { fieldsOfTab } from "@/lib/admin/settings-schema";
import { sendMail } from "@/lib/mail";
import { syncUploadsToStorage } from "@/lib/admin/storage-sync";
import { db } from "@/lib/db";
import type { ActionState } from "@/components/ui/form-state";

export async function saveSettingsTab(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async () => {
    const tab = str(fd, "tab");
    const fields = fieldsOfTab(tab);
    if (!fields.length) return { ok: false, error: "Unknown settings tab." };
    const current = await getSettings();
    const values: Record<string, string> = {};
    for (const f of fields) {
      const v = fd.get(f.key);
      if (typeof v !== "string") continue;
      if (f.type === "password" && v === "") continue; // keep the stored secret
      if (f.type === "number" && v !== "" && !Number.isFinite(Number(v))) return { ok: false, error: `${f.label} must be a number.` };
      if (v !== current[f.key]) values[f.key] = v.trim();
    }
    if (Object.keys(values).length) await setSettings(values);
    if (values["site.theme"] !== undefined) {
      await db.theme.updateMany({ data: { active: false } });
      await db.theme.updateMany({ where: { slug: values["site.theme"] }, data: { active: true } });
    }
    revalidatePath("/", "layout"); revalidatePath("/admin/settings");
    return { ok: true, message: Object.keys(values).length ? `Saved ${Object.keys(values).length} setting(s).` : "No changes." };
  });
}

export async function sendTestEmail(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("settings.manage", async (admin) => {
    const to = str(fd, "to") || admin.email;
    const s = await getSettings();
    const ok = await sendMail({ to, subject: `Test email from ${s["site.name"]}`, html: `<p>This is a test email sent from the admin panel of <strong>${s["site.name"]}</strong> using provider <code>${s["mail.provider"]}</code>.</p>` });
    return ok ? { ok: true, message: `Test email sent to ${to}. (Provider "log" prints to the server console.)` } : { ok: false, error: "Sending failed. Check the server log and your mail settings." };
  });
}

export async function clearCache(): Promise<ActionState> {
  return act("tools.manage", async () => {
    revalidateTag("settings"); revalidateTag("translations"); revalidatePath("/", "layout");
    return { ok: true, message: "Cache cleared: settings, translations and all rendered pages were revalidated." };
  });
}
export async function clearCacheAction(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return clearCache();
}

export async function syncUploads(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return act("tools.manage", async () => {
    const r = await syncUploadsToStorage();
    return { ok: true, message: r.skipped ? `${r.files} local files found. ${r.skipped}` : `Uploaded ${r.uploaded} of ${r.files} files to the bucket.` };
  });
}
