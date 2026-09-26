import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, formatDate } from "@/lib/utils";
import { BLOG_SELECT } from "@/lib/blog";
import { BlogCard } from "@/components/public/blog-list";
import { Breadcrumbs } from "@/components/public/section";
import { AdSlot } from "@/components/public/ad-slot";

type Props = { params: Promise<{ slug: string }> };

async function loadPost(slug: string) {
  return db.blogPost.findFirst({ where: { slug, published: true }, include: { category: true, author: { select: { id: true, username: true, name: true, avatar: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, s] = await Promise.all([loadPost(slug), getSettings()]);
  if (!post) return { title: "Post not found" };
  const url = appUrl(`/blog/${post.slug}`);
  const lang = post.language === "all" ? s["site.defaultLanguage"] || "en" : post.language;
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    keywords: post.tags ? post.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    alternates: { canonical: url, ...(s["seo.hreflang"] === "1" ? { languages: { [lang]: url, "x-default": url } } : {}) },
    openGraph: { type: "article", title: post.seoTitle || post.title, description: post.seoDescription || post.excerpt || undefined, url, images: post.image ? [post.image] : undefined, publishedTime: (post.publishedAt ?? post.createdAt).toISOString(), authors: post.author ? [post.author.name || post.author.username] : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const s = await getSettings();
  if (s["blog.enabled"] !== "1") notFound();
  const post = await loadPost(slug);
  if (!post) notFound();
  db.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => undefined);
  const tags = post.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const related = await db.blogPost.findMany({
    where: { published: true, id: { not: post.id }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) },
    select: BLOG_SELECT, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 3,
  });
  const lang = post.language === "all" ? undefined : post.language;
  const ads = s["ads.enabled"] === "1";
  return (
    <article className="max-w-3xl mx-auto px-4 py-12" lang={lang}>
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/blog", label: "Blog" }, ...(post.category ? [{ href: `/blog/category/${post.category.slug}`, label: post.category.name }] : []), { label: post.title }]} />
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted mt-3">
          {post.author && <Link href={`/blog/author/${post.author.username}`} className="flex items-center gap-2 hover:text-fg">{post.author.avatar ? <img src={post.author.avatar} alt="" className="h-6 w-6 rounded-full" /> : null}{post.author.name || post.author.username}</Link>}
          <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()}>{formatDate(post.publishedAt ?? post.createdAt)}</time>
          <span>{post.views + 1} views</span>
        </div>
      </header>
      {post.image && <img src={post.image} alt="" className="w-full rounded-xl mb-8 object-cover max-h-96" />}
      {ads && <AdSlot code={s["ads.header"]} />}
      <div className="prose-content" dangerouslySetInnerHTML={{ __html: post.content }} />
      {tags.length > 0 && <div className="flex flex-wrap gap-2 mt-8">{tags.map((t) => <Link key={t} href={`/blog?q=${encodeURIComponent(t)}`} className="badge-gray">#{t}</Link>)}</div>}
      {ads && <AdSlot code={s["ads.footer"]} />}
      {post.author && (
        <div className="card p-5 mt-10 flex items-center gap-4">
          {post.author.avatar ? <img src={post.author.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center text-xl font-bold">{(post.author.name || post.author.username).charAt(0).toUpperCase()}</span>}
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">Written by</p>
            <p className="font-semibold">{post.author.name || post.author.username}</p>
            <Link href={`/blog/author/${post.author.username}`} className="text-sm text-primary">View all posts</Link>
          </div>
        </div>
      )}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">Related posts</h2>
          <div className="grid gap-4 md:grid-cols-3">{related.map((r) => <BlogCard key={r.id} post={r} />)}</div>
        </section>
      )}
    </article>
  );
}
