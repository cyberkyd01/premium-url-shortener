import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { Badge, Card, PageHeader, Button } from "@/components/ui";
import { formatDate, json } from "@/lib/utils";
import { ReplyForm, RatingForm } from "./ticket-forms";
import { setTicketStatus } from "../actions";
import { priorityColor, statusColor } from "../badges";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const t = await db.ticket.findFirst({ where: { id, ...(ws.isAdmin ? {} : { userId: ws.userId }) }, include: { category: true, replies: { include: { user: { select: { username: true, name: true, avatar: true } } }, orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  const closed = t.status === "closed";
  return (
    <div className="max-w-3xl">
      <PageHeader title={<span>#{t.number} · {t.subject}</span>} description={<span className="flex flex-wrap items-center gap-2 mt-1"><Badge color={statusColor(t.status)}>{t.status}</Badge><Badge color={priorityColor(t.priority)}>{t.priority}</Badge>{t.category && <span className="text-xs">{t.category.name}</span>}<span className="text-xs">opened {formatDate(t.createdAt, true)}</span></span>}
        actions={<>
          <Link href="/dashboard/support" className="btn-secondary btn-sm">All tickets</Link>
          <form action={setTicketStatus}><input type="hidden" name="ticketId" value={t.id} /><input type="hidden" name="status" value={closed ? "open" : "closed"} /><Button type="submit" variant={closed ? "primary" : "danger"} size="sm">{closed ? "Reopen" : "Close ticket"}</Button></form>
        </>} />
      <div className="space-y-4">
        {t.replies.map((r) => {
          const files = json<string[]>(r.attachments, []);
          return (
            <div key={r.id} className={"card p-4 " + (r.isStaff ? "border-primary/40 bg-primary/5" : "")}>
              <div className="flex items-center justify-between mb-2 text-xs text-muted">
                <span className="font-medium text-fg">{r.user.name ?? r.user.username}{r.isStaff && <Badge color="blue">Staff</Badge>}</span>
                <span>{formatDate(r.createdAt, true)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              {files.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{files.map((f) => <a key={f} href={f} target="_blank" rel="noreferrer" className="badge-gray underline">{f.split("/").pop()}</a>)}</div>}
            </div>
          );
        })}
        {(t.status === "resolved" || closed) && (
          <Card title={t.rating ? "Your rating" : "Rate this ticket"}>
            <RatingForm ticketId={t.id} rating={t.rating} comment={t.ratingComment} />
          </Card>
        )}
        {!closed ? <Card title="Reply"><ReplyForm ticketId={t.id} /></Card> : <p className="text-sm text-muted text-center">This ticket is closed. Reopen it to add a reply.</p>}
      </div>
    </div>
  );
}
