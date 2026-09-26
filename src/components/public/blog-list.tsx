import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

export interface BlogListPost { id: string; title: string; slug: string; excerpt: string | null; image: string | null; publishedAt: Date | null; createdAt: Date; category: { name: string; slug: string } | null; author: { username: string; name: string | null } | null }
export interface BlogCategoryItem { name: string; slug: string; count: number }

export function BlogCard({ post }: { post: BlogListPost }) {
  return (
    <article className="card overflow-hidden flex flex-col">
      {post.image && <Link href={`/blog/${post.slug}`}><img src={post.image} alt="" className="w-full h-44 object-cover" /></Link>}
      <div className="p-5 flex-1 flex flex-col">
        <div className="text-xs text-muted flex flex-wrap gap-2 mb-2">
          {post.category && <Link href={`/blog/category/${post.category.slug}`} className="badge-blue">{post.category.name}</Link>}
          <time dateTime={(post.publishedAt ?? post.createdAt).toISOString()}>{formatDate(post.publishedAt ?? post.createdAt)}</time>
        </div>
        <h2 className="font-semibold text-lg leading-snug"><Link href={`/blog/${post.slug}`} className="hover:text-primary">{post.title}</Link></h2>
        {post.excerpt && <p className="text-sm text-muted mt-2 line-clamp-3">{post.excerpt}</p>}
        {post.author && <p className="text-xs text-muted mt-auto pt-4">By <Link href={`/blog/author/${post.author.username}`} className="hover:text-fg">{post.author.name || post.author.username}</Link></p>}
      </div>
    </article>
  );
}

export function BlogLayout({ title, description, posts, categories, page, pages, hrefFor, q, activeCategory }: {
  title: string; description?: string; posts: BlogListPost[]; categories: BlogCategoryItem[]; page: number; pages: number; hrefFor: (p: number) => string; q?: string; activeCategory?: string;
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8"><h1 className="text-3xl font-bold">{title}</h1>{description && <p className="text-muted mt-1">{description}</p>}</div>
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div>
          {posts.length ? <div className="grid gap-6 md:grid-cols-2">{posts.map((p) => <BlogCard key={p.id} post={p} />)}</div> : <p className="text-muted py-12 text-center">{q ? `No posts match "${q}".` : "No posts yet."}</p>}
          <Pagination page={page} pages={pages} hrefFor={hrefFor} />
        </div>
        <aside className="space-y-6">
          <form action="/blog" className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Search posts" className="input pl-9" aria-label="Search posts" />
          </form>
          {categories.length > 0 && (
            <div className="card p-4">
              <p className="font-semibold text-sm mb-3">Categories</p>
              <ul className="space-y-1 text-sm">
                <li><Link href="/blog" className={!activeCategory ? "text-primary font-medium" : "text-muted hover:text-fg"}>All posts</Link></li>
                {categories.map((c) => (
                  <li key={c.slug} className="flex justify-between"><Link href={`/blog/category/${c.slug}`} className={activeCategory === c.slug ? "text-primary font-medium" : "text-muted hover:text-fg"}>{c.name}</Link><span className="text-xs text-muted">{c.count}</span></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
