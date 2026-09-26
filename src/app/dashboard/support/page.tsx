import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { priorityColor, statusColor } from "./badges";

export const metadata = { title: "Support" };
const STATUSES = ["all", "open", "pending", "resolved", "closed"];


export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { status = "all" } = await searchParams;
  const filter = STATUSES.includes(status) ? status : "all";
  const tickets = await db.ticket.findMany({ where: { userId: ws.userId, ...(filter !== "all" ? { status: filter } : {}) }, include: { category: true, _count: { select: { replies: true } } }, orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Support tickets" description="Get help from our team." actions={<Link href="/dashboard/support/new" className="btn-primary">New ticket</Link>} />
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {STATUSES.map((s) => <Link key={s} href={`/dashboard/support?status=${s}`} className={cn("px-4 py-2 text-sm border-b-2 -mb-px capitalize", filter === s ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-fg")}>{s}</Link>)}
      </div>
      <Card>
        {tickets.length === 0 ? <Empty title="No tickets" description="Open a ticket and we will get back to you as soon as possible." action={<Link href="/dashboard/support/new" className="btn-primary">New ticket</Link>} /> : (
          <div className="overflow-x-auto -mx-5 -my-5"><table className="table">
            <thead><tr><th>#</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Replies</th><th>Updated</th></tr></thead>
            <tbody>{tickets.map((t) => (
              <tr key={t.id}>
                <td className="text-muted">#{t.number}</td>
                <td><Link href={`/dashboard/support/${t.id}`} className="font-medium hover:text-primary">{t.subject}</Link></td>
                <td>{t.category ? <span className="inline-flex items-center gap-1 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: t.category.color }} />{t.category.name}</span> : "-"}</td>
                <td><Badge color={priorityColor(t.priority)}>{t.priority}</Badge></td>
                <td><Badge color={statusColor(t.status)}>{t.status}</Badge></td>
                <td>{t._count.replies}</td>
                <td className="whitespace-nowrap">{formatDate(t.updatedAt, true)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
