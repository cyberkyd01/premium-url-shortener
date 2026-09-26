"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, int, bool } from "@/lib/admin/query";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

export async function saveHelpCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("help.manage", async () => {
    const id = optStr(fd, "id"), name = str(fd, "name");
    if (!name) return { ok: false, error: "Name is required." };
    const slug = slugify(str(fd, "slug") || name);
    if (await db.helpCategory.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already exists." };
    const data = { name, slug, icon: optStr(fd, "icon"), order: int(fd, "order") };
    if (id) await db.helpCategory.update({ where: { id }, data }); else await db.helpCategory.create({ data });
    revalidatePath("/admin/help"); revalidatePath("/help");
    return { ok: true, message: "Category saved." };
  });
}
export async function deleteHelpCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("help.manage", async () => {
    await db.helpCategory.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/help"); revalidatePath("/help");
    return { ok: true, message: "Category deleted." };
  });
}
export async function saveArticle(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("help.manage", async () => {
    const id = optStr(fd, "id"), title = str(fd, "title");
    if (!title) return { ok: false, error: "Title is required." };
    const slug = slugify(str(fd, "slug") || title);
    if (await db.helpArticle.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already exists." };
    const data = { title, slug, content: str(fd, "content", 500000), categoryId: optStr(fd, "categoryId"), published: bool(fd, "published"), order: int(fd, "order") };
    const a = id ? await db.helpArticle.update({ where: { id }, data }) : await db.helpArticle.create({ data });
    revalidatePath("/admin/help"); revalidatePath("/help");
    if (!id) redirect(`/admin/help/${a.id}`);
    return { ok: true, message: "Article saved." };
  });
}
export async function deleteArticle(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("help.manage", async () => {
    await db.helpArticle.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/help"); revalidatePath("/help");
    redirect("/admin/help");
  });
}
