"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr } from "@/lib/admin/query";
import { setSettings } from "@/lib/settings";
import { json, slugify } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";
import { COLOR_SCHEMES, type ThemeConfig } from "@/lib/admin/theme-meta";


export async function themeQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("themes.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const theme = await db.theme.findUnique({ where: { id } });
    if (!theme) return { ok: false, error: "Theme not found." };
    if (op === "activate") {
      await db.theme.updateMany({ data: { active: false } });
      await db.theme.update({ where: { id }, data: { active: true } });
      const cfg = json<ThemeConfig>(theme.config, {});
      // The SaaS theme ships its own landing page: default the homepage to "saas" unless another variant was chosen explicitly.
      const homepage = theme.slug === "saas" && (!cfg.homepage || cfg.homepage === "landing") ? "saas" : cfg.homepage;
      if (theme.slug === "saas" && homepage !== cfg.homepage) await db.theme.update({ where: { id }, data: { config: JSON.stringify({ ...cfg, homepage, palette: cfg.palette ?? "emerald" }) } });
      await setSettings({ "site.theme": theme.slug, ...(cfg.scheme ? { "site.colorScheme": cfg.scheme } : {}), ...(homepage ? { "site.homepage": homepage } : {}) });
    } else if (op === "clone") {
      const base = slugify(str(fd, "name") || `${theme.name} copy`) || `${theme.slug}-copy`;
      let slug = base, i = 2;
      while (await db.theme.findUnique({ where: { slug } })) slug = `${base}-${i++}`;
      const t = await db.theme.create({ data: { slug, name: str(fd, "name") || `${theme.name} copy`, parent: theme.slug, config: theme.config, customCss: theme.customCss, customJs: theme.customJs, overrides: theme.overrides } });
      revalidatePath("/admin/themes");
      redirect(`/admin/themes/${t.slug}`);
    } else if (op === "delete") {
      if (theme.slug === "default" || theme.active) return { ok: false, error: "The default or active theme cannot be deleted." };
      await db.theme.delete({ where: { id } });
    } else return { ok: false, error: "Unknown action." };
    revalidatePath("/admin/themes"); revalidatePath("/", "layout");
    return { ok: true, message: "Done." };
  });
}

/** "Upload theme": accepts a JSON theme file {slug,name,parent?,config,customCss?,customJs?,overrides?}. */
export async function uploadTheme(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("themes.manage", async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a theme JSON file." };
    if (file.name.endsWith(".zip")) return { ok: false, error: "Zip packages are not supported yet: export the theme as JSON (Themes → Export) and upload that file." };
    let data: Record<string, unknown>;
    try { data = JSON.parse(await file.text()) as Record<string, unknown>; } catch { return { ok: false, error: "Invalid JSON." }; }
    const name = typeof data.name === "string" ? data.name : file.name.replace(/\.json$/, "");
    const slug = slugify(typeof data.slug === "string" ? data.slug : name);
    if (!slug) return { ok: false, error: "Theme needs a name/slug." };
    const payload = {
      name, parent: typeof data.parent === "string" ? data.parent : null, config: JSON.stringify(typeof data.config === "object" && data.config ? data.config : {}),
      customCss: typeof data.customCss === "string" ? data.customCss : null, customJs: typeof data.customJs === "string" ? data.customJs : null, overrides: JSON.stringify(typeof data.overrides === "object" && data.overrides ? data.overrides : {}),
    };
    await db.theme.upsert({ where: { slug }, create: { slug, ...payload }, update: payload });
    revalidatePath("/admin/themes");
    return { ok: true, message: `Theme "${name}" installed.` };
  });
}

export async function saveThemeSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("themes.manage", async () => {
    const slug = str(fd, "slug");
    const theme = await db.theme.findUnique({ where: { slug } });
    if (!theme) return { ok: false, error: "Theme not found." };
    const cfg = json<ThemeConfig>(theme.config, {});
    const menu = json<{ label: string; url: string }[]>(str(fd, "menu", 50000), []).filter((m) => m.label && m.url);
    const paletteInput = str(fd, "palette");
    const palette = COLOR_SCHEMES.some((c) => c.key === paletteInput) ? paletteInput : "custom";
    const next: ThemeConfig = { ...cfg, primary: str(fd, "primary") || cfg.primary, accent: str(fd, "accent") || cfg.accent, scheme: str(fd, "scheme") || "system", homepage: str(fd, "homepage") || "default", logo: str(fd, "logo"), font: str(fd, "font"), menu, palette };
    await db.theme.update({ where: { slug }, data: { name: str(fd, "name") || theme.name, parent: optStr(fd, "parent"), config: JSON.stringify(next) } });
    if (theme.active) await setSettings({ "site.colorScheme": next.scheme ?? "system", "site.homepage": next.homepage ?? "default" });
    revalidatePath(`/admin/themes/${slug}`); revalidatePath("/", "layout");
    return { ok: true, message: "Theme settings saved." };
  });
}

export async function saveThemeEditor(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("themes.manage", async () => {
    const slug = str(fd, "slug");
    const rows = json<{ key: string; html: string }[]>(str(fd, "overrides", 2_000_000), []);
    const overrides: Record<string, string> = {};
    for (const r of rows) if (r.key?.trim()) overrides[r.key.trim()] = r.html ?? "";
    await db.theme.update({ where: { slug }, data: { customCss: optStr(fd, "customCss", 500000), customJs: optStr(fd, "customJs", 500000), overrides: JSON.stringify(overrides) } });
    revalidatePath(`/admin/themes/${slug}`); revalidatePath("/", "layout");
    return { ok: true, message: "Theme code saved." };
  });
}
