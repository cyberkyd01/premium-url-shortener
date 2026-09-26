import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { formatBytes } from "@/lib/admin/system";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { Table, Ids } from "@/components/admin/table";
import { deleteFiles } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function FilesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("tools.manage");
  const sp = await searchParams;
  const q = qs(sp, "q");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.HostedFileWhereInput = q ? { OR: [{ name: { contains: q } }, { alias: { contains: q } }, { user: { username: { contains: q } } }] } : {};
  const [rows, total, agg] = await Promise.all([
    db.hostedFile.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } } } }),
    db.hostedFile.count({ where }), db.hostedFile.aggregate({ _sum: { size: true, downloads: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Hosted files" description={`${total} files · ${formatBytes(agg._sum.size ?? 0)} · ${agg._sum.downloads ?? 0} downloads`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Name, alias or user" }]} />
      <BulkForm action={deleteFiles} options={[{ value: "delete", label: "Delete" }]}>
        <Table count={rows.length} head={["", "File", "User", "Size", "Downloads", "Expires", "Created", ""]}>
          {rows.map((f) => (
            <tr key={f.id}>
              <td><Ids id={f.id} /></td>
              <td><a href={`/f/${f.alias}`} target="_blank" className="font-medium text-primary">{f.name}</a><span className="block text-xs text-muted">{f.mime} · /f/{f.alias}{f.password ? " · protected" : ""}{f.encrypted ? " · encrypted" : ""}</span></td>
              <td><Link href={`/admin/users/${f.user.id}`}>{f.user.username}</Link></td>
              <td>{formatBytes(f.size)}</td>
              <td>{f.downloads}</td>
              <td>{f.expiresAt ? formatDate(f.expiresAt) : "-"}</td>
              <td className="text-muted">{formatDate(f.createdAt)}</td>
              <td><RowAction action={deleteFiles} hidden={{ id: f.id }} variant="danger" confirm="Delete this file?">Delete</RowAction></td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/files", sp)} />
    </div>
  );
}
