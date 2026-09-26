"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool } from "@/lib/admin/query";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

export async function savePage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("pages.manage", async () => {
    const id = optStr(fd, "id");
    const title = str(fd, "title");
    if (!title) return { ok: false, error: "Title is required." };
    const slug = slugify(str(fd, "slug") || title);
    if (!slug) return { ok: false, error: "Invalid slug." };
    if (await db.page.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already exists." };
    const data = { title, slug, content: str(fd, "content", 500000), seoTitle: optStr(fd, "seoTitle"), seoDescription: optStr(fd, "seoDescription"), showInHeader: bool(fd, "showInHeader"), showInFooter: bool(fd, "showInFooter"), published: bool(fd, "published"), language: str(fd, "language") || "all" };
    const page = id ? await db.page.update({ where: { id }, data }) : await db.page.create({ data });
    revalidatePath("/admin/pages"); revalidatePath(`/${slug}`); revalidatePath("/", "layout");
    if (!id) redirect(`/admin/pages/${page.id}`);
    return { ok: true, message: "Page saved." };
  });
}

export async function deletePage(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("pages.manage", async () => {
    await db.page.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/pages"); revalidatePath("/", "layout");
    redirect("/admin/pages");
  });
}
