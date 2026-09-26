import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { blogPage } from "@/lib/blog";
import { firstParam } from "@/lib/social";
import { BlogLayout } from "@/components/public/blog-list";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const author = await db.user.findUnique({ where: { username }, select: { name: true, username: true } });
  return { title: author ? `Posts by ${author.name || author.username}` : "Blog" };
}

export default async function BlogAuthorPage({ params, searchParams }: Props) {
  const { username } = await params;
  const sp = await searchParams;
  const s = await getSettings();
  if (s["blog.enabled"] !== "1") notFound();
  const author = await db.user.findUnique({ where: { username }, select: { id: true, name: true, username: true } });
  if (!author) notFound();
  const data = await blogPage({ authorId: author.id }, firstParam(sp, "page"));
  return <BlogLayout title={`Posts by ${author.name || author.username}`} description={`${data.total} post${data.total === 1 ? "" : "s"}`} posts={data.posts} categories={data.categories} page={data.page} pages={data.pages} hrefFor={(p) => `/blog/author/${username}?page=${p}`} />;
}
