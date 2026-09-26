import { db } from "./db";
import { getSettings } from "./settings";
import type { Prisma } from "@prisma/client";

export const BLOG_SELECT = {
  id: true, title: true, slug: true, excerpt: true, image: true, publishedAt: true, createdAt: true,
  category: { select: { name: true, slug: true } }, author: { select: { username: true, name: true } },
} satisfies Prisma.BlogPostSelect;

export async function blogCategories() {
  const cats = await db.blogCategory.findMany({ include: { _count: { select: { posts: { where: { published: true } } } } }, orderBy: { name: "asc" } });
  return cats.filter((c) => c._count.posts > 0).map((c) => ({ name: c.name, slug: c.slug, count: c._count.posts }));
}

export async function blogPage(where: Prisma.BlogPostWhereInput, pageParam: string | undefined) {
  const s = await getSettings();
  const perPage = Math.max(1, parseInt(s["blog.perPage"] || "10", 10));
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const w: Prisma.BlogPostWhereInput = { published: true, ...where };
  const [total, posts, categories] = await Promise.all([
    db.blogPost.count({ where: w }),
    db.blogPost.findMany({ where: w, select: BLOG_SELECT, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * perPage, take: perPage }),
    blogCategories(),
  ]);
  return { posts, categories, page, pages: Math.max(1, Math.ceil(total / perPage)), total };
}
