import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveHelpCategory, deleteHelpCategory } from "./actions";

export default async function HelpAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("help.manage");
  const sp = await searchParams;
  const editCat = qs(sp, "editCat"), q = qs(sp, "q");
  const [cats, articles] = await Promise.all([
    db.helpCategory.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { articles: true } } } }),
    db.helpArticle.findMany({ where: q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}, orderBy: [{ order: "asc" }, { title: "asc" }], include: { category: true } }),
  ]);
  const editing = cats.find((c) => c.id === editCat);
  return (
    <div>
      <PageHeader title="Help center" description={`${cats.length} categories · ${articles.length} articles`} actions={<Link href="/admin/help/new" className="btn-primary">New article</Link>} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form method="get" className="flex gap-2 mb-4"><input name="q" defaultValue={q} className="input w-64" placeholder="Search articles" /><button className="btn-secondary btn-sm">Search</button></form>
          <Table count={articles.length} head={["Article", "Category", "Views", "Helpful", "Order", "Status", ""]}>
            {articles.map((a) => <tr key={a.id}><td><Link href={`/admin/help/${a.id}`} className="font-medium">{a.title}</Link><span className="block text-xs text-muted">/help/{a.slug}</span></td><td>{a.category?.name ?? "-"}</td><td>{a.views}</td><td>{a.helpful}</td><td>{a.order}</td><td><StatusBadge value={a.published ? "published" : "draft"} /></td><td><Link href={`/admin/help/${a.id}`} className="btn-secondary btn-sm">Edit</Link></td></tr>)}
          </Table>
        </div>
        <div className="space-y-4">
          <Card title="Categories">
            <ul className="divide-y divide-border text-sm">
              {cats.map((c) => <li key={c.id} className="py-2 flex items-center justify-between gap-2"><span>{c.icon && <span className="text-muted mr-1">[{c.icon}]</span>}<span className="font-medium">{c.name}</span> <span className="text-xs text-muted">({c._count.articles})</span></span><span className="flex gap-1"><Link href={`/admin/help?editCat=${c.id}`} className="btn-ghost btn-sm">Edit</Link><ActionButton action={deleteHelpCategory} hidden={{ id: c.id }} variant="ghost" confirm="Delete category?" showMessage={false}>✕</ActionButton></span></li>)}
              {cats.length === 0 && <li className="py-2 text-muted">No categories yet.</li>}
            </ul>
          </Card>
          <Card title={editing ? "Edit category" : "Add category"} actions={editing && <Link href="/admin/help" className="btn-ghost btn-sm">New</Link>}>
            <ActionForm key={editing?.id ?? "new"} action={saveHelpCategory} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save">
              <Input label="Name" name="name" defaultValue={editing?.name ?? ""} required />
              <Input label="Slug" name="slug" defaultValue={editing?.slug ?? ""} />
              <div className="grid grid-cols-2 gap-3"><Input label="Icon (lucide name)" name="icon" defaultValue={editing?.icon ?? ""} placeholder="Rocket" /><Input label="Order" name="order" type="number" defaultValue={editing?.order ?? 0} /></div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
