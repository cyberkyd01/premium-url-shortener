"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str } from "@/lib/admin/query";
import { json, slugify } from "@/lib/utils";
import { PLUGIN_CATALOG, BUILTIN_PLUGINS } from "@/lib/admin/plugin-catalog";
import { getSettings, setSettings } from "@/lib/settings";
import { revalidatePlugins } from "@/lib/security";
import type { ActionState } from "@/components/ui/form-state";

export async function pluginQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plugins.manage", async () => {
    const slug = str(fd, "slug"), op = str(fd, "op");
    if (op === "install") {
      const c = PLUGIN_CATALOG.find((p) => p.slug === slug);
      if (!c) return { ok: false, error: "Plugin not in catalog." };
      await db.plugin.upsert({ where: { slug }, create: { slug, name: c.name, version: c.version, active: true }, update: { active: true } });
      if (c.category === "payment") await db.paymentGateway.updateMany({ where: { slug }, data: { enabled: true } });
      if (slug === "noip") await setSettings({ "misc.anonymousStats": "1" });
      revalidatePlugins(); revalidatePath("/admin/plugins");
      return { ok: true, message: `${c.name} installed and activated.` };
    }
    const plugin = await db.plugin.findUnique({ where: { slug } });
    if (!plugin) return { ok: false, error: "Plugin not found." };
    const builtin = BUILTIN_PLUGINS.some((p) => p.slug === slug);
    if (op === "toggle") {
      await db.plugin.update({ where: { slug }, data: { active: !plugin.active } });
      const c = PLUGIN_CATALOG.find((p) => p.slug === slug);
      if (c?.category === "payment") await db.paymentGateway.updateMany({ where: { slug }, data: { enabled: !plugin.active } });
      if (slug === "noip") await setSettings({ "misc.anonymousStats": plugin.active ? "0" : "1" }); // "No IP" maps to misc.anonymousStats
    } else if (op === "uninstall") {
      // Built-in add-ons ship with the app: uninstalling simply deactivates them (rows are re-created on load).
      if (builtin) { await db.plugin.update({ where: { slug }, data: { active: false } }); if (slug === "noip") await setSettings({ "misc.anonymousStats": "0" }); }
      else await db.plugin.delete({ where: { slug } });
    }
    else return { ok: false, error: "Unknown action." };
    revalidatePlugins(); revalidatePath("/admin/plugins"); revalidatePath("/", "layout");
    return { ok: true, message: "Done." };
  });
}

export async function savePluginConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plugins.manage", async () => {
    const slug = str(fd, "slug");
    const plugin = await db.plugin.findUnique({ where: { slug } });
    if (!plugin) return { ok: false, error: "Plugin not found." };
    const config = json<Record<string, string>>(plugin.config, {});
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("c.") || typeof v !== "string") continue;
      const key = k.slice(2);
      if (v === "" && fd.get(`keep.${key}`) === "1") continue;
      config[key] = v.trim();
    }
    await db.plugin.update({ where: { slug }, data: { config: JSON.stringify(config) } });
    revalidatePath("/admin/plugins");
    return { ok: true, message: "Plugin configuration saved." };
  });
}

/** Saves the options of a built-in add-on (stored as `plugin.<slug>.*` settings, not in the plugin's JSON config). */
export async function savePluginSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plugins.manage", async () => {
    const slug = str(fd, "slug");
    const c = BUILTIN_PLUGINS.find((p) => p.slug === slug);
    if (!c?.settingsFields?.length) return { ok: false, error: "This plugin has no configurable options." };
    const current = await getSettings();
    const values: Record<string, string> = {};
    for (const f of c.settingsFields) {
      const v = fd.get(f.key);
      if (typeof v !== "string") continue;
      if (f.type === "password" && v === "") continue; // keep the stored secret
      if (f.type === "number" && v !== "" && !Number.isFinite(Number(v))) return { ok: false, error: `${f.label} must be a number.` };
      if (v.trim() !== current[f.key]) values[f.key] = v.trim();
    }
    if (Object.keys(values).length) await setSettings(values);
    revalidatePath("/admin/plugins"); revalidatePath("/admin/settings");
    return { ok: true, message: Object.keys(values).length ? `${c.name}: saved ${Object.keys(values).length} option(s).` : "No changes." };
  });
}

/** Upload placeholder: accepts a plugin manifest JSON ({slug,name,version,config?}) or a zip (metadata only). */
export async function uploadPlugin(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("plugins.manage", async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a plugin file." };
    let meta: Record<string, unknown> = {};
    if (file.name.endsWith(".json")) { try { meta = JSON.parse(await file.text()) as Record<string, unknown>; } catch { return { ok: false, error: "Invalid manifest JSON." }; } }
    else meta = { slug: slugify(file.name.replace(/\.zip$/i, "")), name: file.name.replace(/\.zip$/i, ""), packaged: true, size: file.size };
    const slug = slugify(typeof meta.slug === "string" ? meta.slug : String(meta.name ?? ""));
    if (!slug) return { ok: false, error: "Manifest needs a slug or name." };
    const name = typeof meta.name === "string" ? meta.name : slug, version = typeof meta.version === "string" ? meta.version : "1.0.0";
    const config = JSON.stringify({ ...(typeof meta.config === "object" && meta.config ? (meta.config as Record<string, unknown>) : {}), uploadedFile: file.name, uploadedAt: new Date().toISOString() });
    await db.plugin.upsert({ where: { slug }, create: { slug, name, version, config }, update: { name, version, config } });
    revalidatePath("/admin/plugins");
    return { ok: true, message: `Plugin "${name}" registered (${file.name}). Code packages must be deployed with the application; this stores the metadata.` };
  });
}
