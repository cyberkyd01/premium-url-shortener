import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { Table, Ids } from "@/components/admin/table";
import { deleteQr } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function QrAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("qr.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), type = qs(sp, "type");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.QrCodeWhereInput = { ...(q ? { OR: [{ name: { contains: q } }, { data: { contains: q } }, { user: { username: { contains: q } } }] } : {}), ...(type ? { type } : {}) };
  const [rows, total, types] = await Promise.all([
    db.qrCode.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, link: { select: { alias: true } } } }),
    db.qrCode.count({ where }), db.qrCode.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);
  return (
    <div>
      <PageHeader title="QR codes" description={`${total} QR codes`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Name, content or user" }, { name: "type", type: "select", value: type, options: [{ value: "", label: "All types" }, ...types.map((t) => ({ value: t.type, label: `${t.type} (${t._count._all})` }))] }]} />
      <BulkForm action={deleteQr} options={[{ value: "delete", label: "Delete" }]}>
        <Table count={rows.length} head={["", "Preview", "Name", "Type", "User", "Scans", "Created", ""]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Ids id={r.id} /></td>
              <td>{r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded border border-border" /> : <span className="text-muted text-xs">-</span>}</td>
              <td><span className="font-medium">{r.name}</span><span className="block text-xs text-muted truncate max-w-[220px]">{r.link ? `/${r.link.alias}` : r.data}</span></td>
              <td>{r.type}{r.isDynamic && <span className="badge-blue ml-1">dynamic</span>}</td>
              <td>{r.user ? <Link href={`/admin/users/${r.user.id}`}>{r.user.username}</Link> : <span className="text-muted">guest</span>}</td>
              <td>{r.scans}</td>
              <td className="text-muted">{formatDate(r.createdAt)}</td>
              <td><RowAction action={deleteQr} hidden={{ id: r.id }} variant="danger" confirm="Delete this QR code?">Delete</RowAction></td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/qr", sp)} />
    </div>
  );
}
