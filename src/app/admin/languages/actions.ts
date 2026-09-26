"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool } from "@/lib/admin/query";
import en from "@/locales/en.json";
import type { ActionState } from "@/components/ui/form-state";

const EN = en as Record<string, string>;

export async function saveLanguage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("languages.manage", async () => {
    const id = optStr(fd, "id");
    const code = str(fd, "code").toLowerCase().replace(/[^a-z-]/g, "").slice(0, 10), name = str(fd, "name");
    if (!code || !name) return { ok: false, error: "Code and name are required." };
    if (await db.language.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Language code already exists." };
    const isDefault = bool(fd, "isDefault");
    const data = { code, name, flag: optStr(fd, "flag"), rtl: bool(fd, "rtl"), active: bool(fd, "active") || isDefault, isDefault };
    if (isDefault) await db.language.updateMany({ data: { isDefault: false } });
    if (id) await db.language.update({ where: { id }, data }); else await db.language.create({ data });
    revalidateTag("translations"); revalidatePath("/admin/languages"); revalidatePath("/", "layout");
    return { ok: true, message: "Language saved." };
  });
}

export async function languageQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("languages.manage", async () => {
    const id = str(fd, "id"), op = str(fd, "op");
    const lang = await db.language.findUnique({ where: { id } });
    if (!lang) return { ok: false, error: "Language not found." };
    if (op === "delete") { if (lang.isDefault) return { ok: false, error: "Cannot delete the default language." }; await db.language.delete({ where: { id } }); }
    else if (op === "toggle") await db.language.update({ where: { id }, data: { active: !lang.active } });
    else if (op === "default") { await db.language.updateMany({ data: { isDefault: false } }); await db.language.update({ where: { id }, data: { isDefault: true, active: true } }); }
    revalidateTag("translations"); revalidatePath("/admin/languages"); revalidatePath("/", "layout");
    return { ok: true, message: "Done." };
  });
}

async function upsertStrings(languageId: string, values: Record<string, string>, onlyMissing = false) {
  const existing = onlyMissing ? new Set((await db.translation.findMany({ where: { languageId }, select: { key: true } })).map((t) => t.key)) : new Set<string>();
  const entries = Object.entries(values).filter(([k, v]) => typeof v === "string" && !(onlyMissing && existing.has(k)));
  for (let i = 0; i < entries.length; i += 100) {
    await db.$transaction(entries.slice(i, i + 100).map(([key, value]) => db.translation.upsert({ where: { languageId_key: { languageId, key } }, create: { languageId, key, value }, update: { value } })));
  }
  return entries.length;
}

export async function saveTranslations(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("languages.manage", async () => {
    const lang = await db.language.findUnique({ where: { code: str(fd, "code") } });
    if (!lang) return { ok: false, error: "Language not found." };
    const values: Record<string, string> = {};
    const remove: string[] = [];
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("t:") || typeof v !== "string") continue;
      const key = k.slice(2);
      if (v.trim() === "") remove.push(key); else values[key] = v;
    }
    const n = await upsertStrings(lang.id, values);
    if (remove.length) await db.translation.deleteMany({ where: { languageId: lang.id, key: { in: remove } } });
    revalidateTag("translations"); revalidatePath(`/admin/languages/${lang.code}`);
    return { ok: true, message: `Saved ${n} strings.` };
  });
}

export async function autofillTranslations(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("languages.manage", async () => {
    const lang = await db.language.findUnique({ where: { code: str(fd, "code") } });
    if (!lang) return { ok: false, error: "Language not found." };
    const n = await upsertStrings(lang.id, EN, true);
    revalidateTag("translations"); revalidatePath(`/admin/languages/${lang.code}`);
    return { ok: true, message: `Filled ${n} missing strings with English.` };
  });
}

export async function importTranslations(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("languages.manage", async () => {
    const lang = await db.language.findUnique({ where: { code: str(fd, "code") } });
    if (!lang) return { ok: false, error: "Language not found." };
    const file = fd.get("file");
    let text = typeof file === "object" && file && "text" in file ? await (file as File).text() : str(fd, "json", 2_000_000);
    if (!text.trim()) return { ok: false, error: "Upload a JSON file or paste JSON." };
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { ok: false, error: "Invalid JSON." }; }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, error: "JSON must be an object of key → string." };
    const obj = parsed as Record<string, unknown>;
    const strings = "strings" in obj && typeof obj.strings === "object" && obj.strings ? (obj.strings as Record<string, unknown>) : obj;
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(strings)) if (typeof v === "string") values[k] = v;
    const n = await upsertStrings(lang.id, values);
    text = "";
    revalidateTag("translations"); revalidatePath(`/admin/languages/${lang.code}`);
    return { ok: true, message: `Imported ${n} strings.` };
  });
}
