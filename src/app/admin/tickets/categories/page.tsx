import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { Table } from "@/components/admin/table";
import { TicketTabs } from "@/components/admin/ticket-tabs";
import { saveTicketCategory, deleteTicketCategory } from "../actions";

export default async function TicketCategories({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("tools.manage");
  const editId = qs(await searchParams, "edit");
  const rows = await db.ticketCategory.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { tickets: true } } } });
  const editing = rows.find((r) => r.id === editId);
  return (
    <div>
      <PageHeader title="Ticket categories" />
      <TicketTabs active="categories" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><Table count={rows.length} head={["Category", "Tickets", "Order", ""]}>{rows.map((r) => <tr key={r.id}><td><span className="inline-block h-3 w-3 rounded-full mr-2 align-middle" style={{ background: r.color }} /><span className="font-medium">{r.name}</span></td><td>{r._count.tickets}</td><td>{r.order}</td><td className="space-x-1 whitespace-nowrap"><Link href={`/admin/tickets/categories?edit=${r.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteTicketCategory} hidden={{ id: r.id }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}</Table></div>
        <Card title={editing ? "Edit category" : "New category"} actions={editing && <Link href="/admin/tickets/categories" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveTicketCategory} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save"><Input label="Name" name="name" defaultValue={editing?.name ?? ""} required /><div className="grid grid-cols-2 gap-3"><Input label="Color" name="color" type="color" defaultValue={editing?.color ?? "#6366f1"} /><Input label="Order" name="order" type="number" defaultValue={editing?.order ?? 0} /></div></ActionForm>
        </Card>
      </div>
    </div>
  );
}
