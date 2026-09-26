import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { reportQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function ReportsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("reports.manage");
  const sp = await searchParams;
  const status = qs(sp, "status", "pending"), q = qs(sp, "q");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.ReportWhereInput = { ...(status ? { status } : {}), ...(q ? { OR: [{ url: { contains: q } }, { reason: { contains: q } }, { email: { contains: q } }] } : {}) };
  const [rows, total] = await Promise.all([db.report.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } } } }), db.report.count({ where })]);
  const linkIds = rows.map((r) => r.linkId).filter((v): v is string => !!v);
  const links = linkIds.length ? await db.link.findMany({ where: { id: { in: linkIds } }, select: { id: true, alias: true, url: true, status: true } }) : [];
  const linkMap = new Map(links.map((l) => [l.id, l]));
  return (
    <div>
      <PageHeader title="Abuse reports" description={`${total} reports`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "URL, reason or email" }, { name: "status", type: "select", value: status, options: [{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "resolved", label: "Resolved" }, { value: "dismissed", label: "Dismissed" }] }]} />
      <Table count={rows.length} head={["Reported item", "Reason", "Reporter", "Status", "Date", ""]}>
        {rows.map((r) => {
          const link = r.linkId ? linkMap.get(r.linkId) : undefined;
          return (
            <tr key={r.id}>
              <td className="max-w-xs">
                {link ? <Link href={`/admin/links/${link.id}`} className="font-medium text-primary">/{link.alias}</Link> : r.bioPageId ? <span className="font-medium">Bio page</span> : <span className="font-medium">URL</span>}
                <span className="block text-xs text-muted truncate">{link?.url ?? r.url ?? r.bioPageId}</span>
                {link && <StatusBadge value={link.status} />}
              </td>
              <td className="max-w-sm"><span className="font-medium">{r.reason}</span>{r.details && <span className="block text-xs text-muted whitespace-pre-wrap">{r.details}</span>}</td>
              <td>{r.user ? <Link href={`/admin/users/${r.user.id}`}>{r.user.username}</Link> : r.email ?? <span className="text-muted">anonymous</span>}</td>
              <td><StatusBadge value={r.status} /></td>
              <td className="text-muted">{formatDate(r.createdAt, true)}</td>
              <td className="whitespace-nowrap space-x-1">
                {r.status === "pending" && <>
                  <ActionButton action={reportQuick} hidden={{ id: r.id, op: "resolve", block: "1" }} variant="danger" confirm="Block the reported link/page and resolve?" showMessage={false}>Block & resolve</ActionButton>
                  <ActionButton action={reportQuick} hidden={{ id: r.id, op: "resolve" }} variant="primary" showMessage={false}>Resolve</ActionButton>
                  <ActionButton action={reportQuick} hidden={{ id: r.id, op: "dismiss" }} showMessage={false}>Dismiss</ActionButton>
                </>}
                <ActionButton action={reportQuick} hidden={{ id: r.id, op: "delete" }} variant="ghost" confirm="Delete report?" showMessage={false}>Delete</ActionButton>
              </td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/reports", sp)} />
    </div>
  );
}
