import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { Table, StatusBadge } from "@/components/admin/table";
import { TicketTabs } from "@/components/admin/ticket-tabs";
import type { Prisma } from "@prisma/client";

export default async function TicketsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("tools.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), status = qs(sp, "status", "open"), priority = qs(sp, "priority"), categoryId = qs(sp, "category"), assigneeId = qs(sp, "assignee");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.TicketWhereInput = {
    ...(q ? { OR: [{ subject: { contains: q } }, { user: { OR: [{ username: { contains: q } }, { email: { contains: q } }] } }, ...(/^\d+$/.test(q) ? [{ number: parseInt(q, 10) }] : [])] } : {}),
    ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(categoryId ? { categoryId } : {}), ...(assigneeId === "none" ? { assigneeId: null } : assigneeId ? { assigneeId } : {}),
  };
  const [rows, total, cats, admins, openCount] = await Promise.all([
    db.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, category: true, _count: { select: { replies: true } } } }),
    db.ticket.count({ where }), db.ticketCategory.findMany({ orderBy: { order: "asc" } }), db.user.findMany({ where: { role: "admin" }, select: { id: true, username: true } }), db.ticket.count({ where: { status: "open" } }),
  ]);
  const adminMap = new Map(admins.map((a) => [a.id, a.username]));
  return (
    <div>
      <PageHeader title="Helpdesk" description={`${total} tickets`} />
      <TicketTabs active="tickets" open={openCount} />
      <FilterBar fields={[
        { name: "q", value: q, placeholder: "Subject, user or #number" },
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, ...["open", "pending", "resolved", "closed"].map((s) => ({ value: s, label: s }))] },
        { name: "priority", type: "select", value: priority, options: [{ value: "", label: "All priorities" }, ...["low", "medium", "high", "urgent"].map((s) => ({ value: s, label: s }))] },
        { name: "category", type: "select", value: categoryId, options: [{ value: "", label: "All categories" }, ...cats.map((c) => ({ value: c.id, label: c.name }))] },
        { name: "assignee", type: "select", value: assigneeId, options: [{ value: "", label: "Any assignee" }, { value: "none", label: "Unassigned" }, ...admins.map((a) => ({ value: a.id, label: a.username }))] },
      ]} />
      <Table count={rows.length} head={["#", "Subject", "User", "Category", "Priority", "Assignee", "Status", "Updated", ""]}>
        {rows.map((t) => <tr key={t.id}><td className="text-muted">{t.number}</td><td><Link href={`/admin/tickets/${t.id}`} className="font-medium">{t.subject}</Link><span className="block text-xs text-muted">{t._count.replies} replies</span></td><td><Link href={`/admin/users/${t.user.id}`}>{t.user.username}</Link></td><td>{t.category ? <span className="badge" style={{ background: t.category.color + "22", color: t.category.color }}>{t.category.name}</span> : "-"}</td><td><StatusBadge value={t.priority === "urgent" ? "failed" : t.priority === "high" ? "pending" : t.priority} /></td><td>{t.assigneeId ? adminMap.get(t.assigneeId) ?? "-" : <span className="text-muted">unassigned</span>}</td><td><StatusBadge value={t.status} /></td><td className="text-muted">{formatDate(t.updatedAt, true)}</td><td><Link href={`/admin/tickets/${t.id}`} className="btn-secondary btn-sm">Open</Link></td></tr>)}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/tickets", sp)} />
    </div>
  );
}
