"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, bool, date, ids } from "@/lib/admin/query";
import { slugify } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

export async function savePost(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("blog.manage", async (admin) => {
    const id = optStr(fd, "id");
    const title = str(fd, "title");
    if (!title) return { ok: false, error: "Title is required." };
    const slug = slugify(str(fd, "slug") || title);
    if (await db.blogPost.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already exists." };
    const published = bool(fd, "published");
    const data = {
      title, slug, excerpt: optStr(fd, "excerpt"), content: str(fd, "content", 500000), image: optStr(fd, "image"), categoryId: optStr(fd, "categoryId"),
      tags: str(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean).join(","), seoTitle: optStr(fd, "seoTitle"), seoDescription: optStr(fd, "seoDescription"),
      published, language: str(fd, "language") || "all", publishedAt: date(fd, "publishedAt") ?? (published ? new Date() : null),
    };
    const post = id ? await db.blogPost.update({ where: { id }, data }) : await db.blogPost.create({ data: { ...data, authorId: admin.id } });
    revalidatePath("/admin/blog"); revalidatePath("/blog"); revalidatePath(`/blog/${slug}`);
    if (!id) redirect(`/admin/blog/${post.id}`);
    return { ok: true, message: "Post saved." };
  });
}

export async function deletePost(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("blog.manage", async () => {
    await db.blogPost.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/blog"); revalidatePath("/blog");
    redirect("/admin/blog");
  });
}

export async function bulkPosts(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("blog.manage", async () => {
    const selected = ids(fd), op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one post." };
    if (op === "publish") await db.blogPost.updateMany({ where: { id: { in: selected } }, data: { published: true, publishedAt: new Date() } });
    else if (op === "unpublish") await db.blogPost.updateMany({ where: { id: { in: selected } }, data: { published: false } });
    else if (op === "delete") await db.blogPost.deleteMany({ where: { id: { in: selected } } });
    else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/blog"); revalidatePath("/blog");
    return { ok: true, message: `Applied to ${selected.length} posts.` };
  });
}

export async function saveCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("blog.manage", async () => {
    const id = optStr(fd, "id"), name = str(fd, "name");
    if (!name) return { ok: false, error: "Name is required." };
    const slug = slugify(str(fd, "slug") || name);
    if (await db.blogCategory.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) return { ok: false, error: "Slug already exists." };
    if (id) await db.blogCategory.update({ where: { id }, data: { name, slug } }); else await db.blogCategory.create({ data: { name, slug } });
    revalidatePath("/admin/blog/categories"); revalidatePath("/blog");
    return { ok: true, message: "Category saved." };
  });
}

export async function deleteCategory(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("blog.manage", async () => {
    await db.blogCategory.delete({ where: { id: str(fd, "id") } });
    revalidatePath("/admin/blog/categories"); revalidatePath("/blog");
    return { ok: true, message: "Category deleted." };
  });
}
