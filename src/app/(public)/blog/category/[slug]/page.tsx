import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { blogPage } from "@/lib/blog";
import { firstParam } from "@/lib/social";
import { BlogLayout } from "@/components/public/blog-list";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await db.blogCategory.findUnique({ where: { slug } });
  return { title: cat ? `${cat.name} · Blog` : "Blog" };
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const s = await getSettings();
  if (s["blog.enabled"] !== "1") notFound();
  const cat = await db.blogCategory.findUnique({ where: { slug } });
  if (!cat) notFound();
  const data = await blogPage({ categoryId: cat.id }, firstParam(sp, "page"));
  return <BlogLayout title={cat.name} description={`${data.total} post${data.total === 1 ? "" : "s"} in this category`} posts={data.posts} categories={data.categories} page={data.page} pages={data.pages} hrefFor={(p) => `/blog/category/${slug}?page=${p}`} activeCategory={slug} />;
}
