import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { Table, StatusBadge, Ids } from "@/components/admin/table";
import { bulkPosts } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function BlogAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("blog.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), categoryId = qs(sp, "category"), status = qs(sp, "status");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.BlogPostWhereInput = { ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }, { tags: { contains: q } }] } : {}), ...(categoryId ? { categoryId } : {}), ...(status === "published" ? { published: true } : status === "draft" ? { published: false } : {}) };
  const [posts, total, categories] = await Promise.all([
    db.blogPost.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { category: true, author: { select: { username: true } } } }),
    db.blogPost.count({ where }), db.blogCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Blog" description={`${total} posts`} actions={<><Link href="/admin/blog/categories" className="btn-secondary">Categories</Link><Link href="/admin/blog/new" className="btn-primary">New post</Link></>} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Title, slug or tag" }, { name: "category", type: "select", value: categoryId, options: [{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))] }, { name: "status", type: "select", value: status, options: [{ value: "", label: "All" }, { value: "published", label: "Published" }, { value: "draft", label: "Draft" }] }]} />
      <BulkForm action={bulkPosts} options={[{ value: "publish", label: "Publish" }, { value: "unpublish", label: "Unpublish" }, { value: "delete", label: "Delete" }]}>
        <Table count={posts.length} head={["", "Post", "Category", "Author", "Views", "Status", "Date", ""]}>
          {posts.map((p) => <tr key={p.id}><td><Ids id={p.id} /></td><td><Link href={`/admin/blog/${p.id}`} className="font-medium">{p.title}</Link><span className="block text-xs text-muted">/blog/{p.slug}{p.language !== "all" ? ` · ${p.language}` : ""}</span></td><td>{p.category?.name ?? "-"}</td><td>{p.author?.username ?? "-"}</td><td>{p.views}</td><td><StatusBadge value={p.published ? "published" : "draft"} /></td><td className="text-muted">{formatDate(p.publishedAt ?? p.createdAt)}</td><td><Link href={`/admin/blog/${p.id}`} className="btn-secondary btn-sm">Edit</Link></td></tr>)}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/blog", sp)} />
    </div>
  );
}
