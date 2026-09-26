import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { blogPage } from "@/lib/blog";
import { firstParam } from "@/lib/social";
import { BlogLayout } from "@/components/public/blog-list";
import { Rss } from "lucide-react";

export const metadata: Metadata = { title: "Blog", description: "News, guides and tips about link management, marketing and analytics.", alternates: { types: { "application/rss+xml": "/blog/feed.xml" } } };

export default async function BlogIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  if (s["blog.enabled"] !== "1") notFound();
  const q = (firstParam(sp, "q") ?? "").trim();
  const where = q ? { OR: [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }, { tags: { contains: q } }] } : {};
  const data = await blogPage(where, firstParam(sp, "page"));
  const base = q ? `/blog?q=${encodeURIComponent(q)}&` : "/blog?";
  return (
    <>
      <BlogLayout title={q ? `Search: ${q}` : "Blog"} description={q ? `${data.total} result${data.total === 1 ? "" : "s"}` : "News, guides and tips from the team."} posts={data.posts} categories={data.categories} page={data.page} pages={data.pages} hrefFor={(p) => `${base}page=${p}`} q={q} />
      <p className="max-w-6xl mx-auto px-4 pb-10 text-xs text-muted"><a href="/blog/feed.xml" className="inline-flex items-center gap-1 hover:text-primary"><Rss size={12} />Subscribe via RSS</a></p>
    </>
  );
}
