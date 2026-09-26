import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { Table } from "@/components/admin/table";
import { saveCategory, deleteCategory } from "../actions";

export default async function BlogCategories({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("blog.manage");
  const editId = qs(await searchParams, "edit");
  const cats = await db.blogCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } });
  const editing = cats.find((c) => c.id === editId);
  return (
    <div>
      <PageHeader title="Blog categories" actions={<Link href="/admin/blog" className="btn-secondary">← Posts</Link>} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Table count={cats.length} head={["Name", "Slug", "Posts", ""]}>
            {cats.map((c) => <tr key={c.id}><td className="font-medium">{c.name}</td><td>{c.slug}</td><td><Link href={`/admin/blog?category=${c.id}`}>{c._count.posts}</Link></td><td className="space-x-1 whitespace-nowrap"><Link href={`/admin/blog/categories?edit=${c.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteCategory} hidden={{ id: c.id }} variant="danger" confirm="Delete category? Posts keep existing without a category." showMessage={false}>Delete</ActionButton></td></tr>)}
          </Table>
        </div>
        <Card title={editing ? "Edit category" : "Add category"} actions={editing && <Link href="/admin/blog/categories" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveCategory} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save"><Input label="Name" name="name" defaultValue={editing?.name ?? ""} required /><Input label="Slug" name="slug" defaultValue={editing?.slug ?? ""} /></ActionForm>
        </Card>
      </div>
    </div>
  );
}
