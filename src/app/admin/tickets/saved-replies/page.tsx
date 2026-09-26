import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { Table } from "@/components/admin/table";
import { TicketTabs } from "@/components/admin/ticket-tabs";
import { saveSavedReply, deleteSavedReply } from "../actions";

export default async function SavedReplies({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("tools.manage");
  const editId = qs(await searchParams, "edit");
  const rows = await db.savedReply.findMany({ orderBy: { title: "asc" } });
  const editing = rows.find((r) => r.id === editId);
  return (
    <div>
      <PageHeader title="Saved replies" description="Canned answers you can insert into ticket replies." />
      <TicketTabs active="saved" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><Table count={rows.length} head={["Title", "Content", ""]}>{rows.map((r) => <tr key={r.id}><td className="font-medium">{r.title}</td><td className="text-xs text-muted max-w-md truncate">{r.content}</td><td className="space-x-1 whitespace-nowrap"><Link href={`/admin/tickets/saved-replies?edit=${r.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteSavedReply} hidden={{ id: r.id }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}</Table></div>
        <Card title={editing ? "Edit saved reply" : "New saved reply"} actions={editing && <Link href="/admin/tickets/saved-replies" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveSavedReply} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save"><Input label="Title" name="title" defaultValue={editing?.title ?? ""} required /><Textarea label="Content" name="content" defaultValue={editing?.content ?? ""} required rows={8} /></ActionForm>
        </Card>
      </div>
    </div>
  );
}
