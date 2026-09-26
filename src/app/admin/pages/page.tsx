import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Table, StatusBadge } from "@/components/admin/table";

export default async function PagesAdmin() {
  await adminPage("pages.manage");
  const pages = await db.page.findMany({ orderBy: { title: "asc" } });
  return (
    <div>
      <PageHeader title="Pages" description="Static CMS pages (terms, privacy, about…)." actions={<Link href="/admin/pages/new" className="btn-primary">Create page</Link>} />
      <Table count={pages.length} head={["Title", "Slug", "Visibility", "Language", "Published", "Updated", ""]}>
        {pages.map((p) => <tr key={p.id}><td><Link href={`/admin/pages/${p.id}`} className="font-medium">{p.title}</Link></td><td><a href={`/${p.slug}`} target="_blank" className="text-primary">/{p.slug}</a></td><td className="text-xs text-muted">{[p.showInHeader && "header", p.showInFooter && "footer"].filter(Boolean).join(", ") || "-"}</td><td>{p.language}</td><td><StatusBadge value={p.published ? "published" : "draft"} /></td><td className="text-muted">{formatDate(p.updatedAt)}</td><td><Link href={`/admin/pages/${p.id}`} className="btn-secondary btn-sm">Edit</Link></td></tr>)}
      </Table>
    </div>
  );
}
