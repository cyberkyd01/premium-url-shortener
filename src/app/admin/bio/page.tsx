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
import { Table, StatusBadge, Ids } from "@/components/admin/table";
import { bioQuick, bulkBio } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function BioPagesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("bio.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), status = qs(sp, "status");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.BioPageWhereInput = { ...(q ? { OR: [{ alias: { contains: q } }, { name: { contains: q } }, { user: { username: { contains: q } } }] } : {}), ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    db.bioPage.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, domain: true, _count: { select: { blocks: true } } } }),
    db.bioPage.count({ where }),
  ]);
  return (
    <div>
      <PageHeader title="Bio pages" description={`${total} pages`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Alias, name or user" }, { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }] }]} />
      <BulkForm action={bulkBio} options={[{ value: "enable", label: "Enable" }, { value: "disable", label: "Disable" }, { value: "delete", label: "Delete" }]}>
        <Table count={rows.length} head={["", "Page", "User", "Blocks", "Views", "Status", "Created", ""]}>
          {rows.map((b) => (
            <tr key={b.id}>
              <td><Ids id={b.id} /></td>
              <td><a href={b.domain ? `https://${b.domain.domain}/${b.alias}` : `/${b.alias}`} target="_blank" className="font-medium text-primary">{b.domain?.domain ?? ""}/{b.alias}</a>{b.verified && <span className="badge-blue ml-1">✓</span>}<span className="block text-xs text-muted">{b.name ?? ""}{b.isDefault ? " · default" : ""}</span></td>
              <td><Link href={`/admin/users/${b.user.id}`}>{b.user.username}</Link></td>
              <td>{b._count.blocks}</td>
              <td>{b.views} <span className="text-xs text-muted">({b.uniqueViews} unique)</span></td>
              <td><StatusBadge value={b.status} /></td>
              <td className="text-muted">{formatDate(b.createdAt)}</td>
              <td className="whitespace-nowrap space-x-1">
                <RowAction action={bioQuick} hidden={{ id: b.id, op: "verified" }}>{b.verified ? "Unverify" : "Verify"}</RowAction>
                {b.status === "active" ? <RowAction action={bioQuick} hidden={{ id: b.id, op: "disable" }}>Disable</RowAction> : <RowAction action={bioQuick} hidden={{ id: b.id, op: "enable" }}>Enable</RowAction>}
                <RowAction action={bioQuick} hidden={{ id: b.id, op: "delete" }} variant="danger" confirm="Delete this bio page?">Delete</RowAction>
              </td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/bio", sp)} />
    </div>
  );
}
