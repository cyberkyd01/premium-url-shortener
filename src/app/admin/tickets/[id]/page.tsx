import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatDate, json } from "@/lib/utils";
import { Card, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/table";
import { TicketReplyForm } from "@/components/admin/ticket-reply-form";
import { replyTicket, updateTicket, deleteTicket } from "../actions";

export default async function TicketView({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("tools.manage");
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, include: { user: true, category: true, replies: { orderBy: { createdAt: "asc" }, include: { user: { select: { username: true, avatar: true } } } } } });
  if (!t) notFound();
  const [saved, cats, admins] = await Promise.all([db.savedReply.findMany({ orderBy: { title: "asc" } }), db.ticketCategory.findMany({ orderBy: { order: "asc" } }), db.user.findMany({ where: { role: "admin" }, select: { id: true, username: true } })]);
  const custom = json<Record<string, string>>(t.customFields, {});
  return (
    <div>
      <PageHeader title={`#${t.number} ${t.subject}`} description={<><StatusBadge value={t.status} /> <span className="ml-2">opened {formatDate(t.createdAt, true)} by <Link href={`/admin/users/${t.user.id}`} className="text-primary">{t.user.username}</Link></span></>}
        actions={<><Link href="/admin/tickets" className="btn-secondary">← Tickets</Link><ActionButton action={deleteTicket} hidden={{ id }} variant="danger" confirm="Delete this ticket?">Delete</ActionButton></>} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {t.replies.map((r) => (
            <div key={r.id} className={`card p-4 ${r.isStaff ? "border-primary/40" : ""}`}>
              <div className="flex justify-between text-xs text-muted mb-2"><span className="font-medium text-fg">{r.user.username}{r.isStaff && <span className="badge-blue ml-2">staff</span>}</span><span>{formatDate(r.createdAt, true)}</span></div>
              <div className="text-sm whitespace-pre-wrap">{r.message}</div>
              {json<string[]>(r.attachments, []).length > 0 && <ul className="flex flex-wrap gap-2 mt-2 text-xs">{json<string[]>(r.attachments, []).map((a) => <li key={a}><a href={a} target="_blank" className="badge-gray underline">{a.split("/").pop()}</a></li>)}</ul>}
            </div>
          ))}
          {t.replies.length === 0 && <p className="text-sm text-muted">No messages.</p>}
          <Card title="Reply"><TicketReplyForm action={replyTicket} ticketId={id} savedReplies={saved} statuses={["pending", "open", "resolved", "closed"]} /></Card>
        </div>
        <div className="space-y-4">
          <Card title="Properties">
            <ActionForm action={updateTicket} hidden={{ id }} submitLabel="Update">
              <Select label="Status" name="status" defaultValue={t.status}>{["open", "pending", "resolved", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
              <Select label="Priority" name="priority" defaultValue={t.priority}>{["low", "medium", "high", "urgent"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
              <Select label="Category" name="categoryId" defaultValue={t.categoryId ?? ""}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Select label="Assignee" name="assigneeId" defaultValue={t.assigneeId ?? ""}><option value="">Unassigned</option>{admins.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}</Select>
            </ActionForm>
          </Card>
          <Card title="Requester">
            <dl className="text-sm grid grid-cols-2 gap-y-1"><dt className="text-muted">User</dt><dd><Link href={`/admin/users/${t.user.id}`} className="text-primary">{t.user.username}</Link></dd><dt className="text-muted">Email</dt><dd className="truncate">{t.user.email}</dd><dt className="text-muted">Rating</dt><dd>{t.rating ? `${"★".repeat(t.rating)} ${t.ratingComment ?? ""}` : "-"}</dd>
              {Object.entries(custom).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
