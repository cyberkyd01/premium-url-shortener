import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { formatDate, cn } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmForm } from "@/components/ui/confirm";
import { markRead, markAllRead, deleteNotification, deleteAllRead } from "./actions";

export const metadata = { title: "Notifications" };
const PER_PAGE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string; filter?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where = { userId: ws.userId, ...(sp.filter === "unread" ? { read: false } : {}) };
  const [total, unread, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId: ws.userId, read: false } }),
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
  ]);
  const icon = (type: string) => type === "warning" || type === "error" ? <AlertTriangle size={16} className="text-warning" /> : type === "success" ? <CheckCircle2 size={16} className="text-success" /> : <Info size={16} className="text-primary" />;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up."} actions={<>
        <Link href="/dashboard/notifications" className={cn("btn-secondary btn-sm", sp.filter !== "unread" && "border-primary text-primary")}>All</Link>
        <Link href="/dashboard/notifications?filter=unread" className={cn("btn-secondary btn-sm", sp.filter === "unread" && "border-primary text-primary")}>Unread</Link>
        {unread > 0 && <form action={markAllRead}><button className="btn-secondary btn-sm"><CheckCheck size={14} /> Mark all read</button></form>}
        <ConfirmForm action={deleteAllRead} message="Delete all read notifications?"><button className="btn-ghost btn-sm"><Trash2 size={14} /> Clear read</button></ConfirmForm>
      </>} />
      {items.length === 0 ? <div className="card"><Empty title="No notifications" description="Important events about your account and links will show up here." /></div> : (
        <div className="card divide-y divide-border">
          {items.map((n) => (
            <div key={n.id} className={cn("flex items-start gap-3 p-4", !n.read && "bg-primary/5")}>
              <span className="mt-0.5 shrink-0">{icon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                <p className="text-sm text-muted mt-0.5 whitespace-pre-line">{n.message}</p>
                <p className="text-xs text-muted mt-1 flex items-center gap-2"><Bell size={11} /> {formatDate(n.createdAt, true)}{n.link && <Link href={n.link} className="text-primary">Open →</Link>}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && <form action={markRead}><input type="hidden" name="id" value={n.id} /><button className="btn-ghost btn-sm !px-2" title="Mark as read"><Check size={14} /></button></form>}
                <ConfirmForm action={deleteNotification} hidden={{ id: n.id }} message="Delete this notification?"><button className="btn-ghost btn-sm !px-2 text-danger" title="Delete"><Trash2 size={14} /></button></ConfirmForm>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/dashboard/notifications?page=${p}${sp.filter ? `&filter=${sp.filter}` : ""}`} />
    </>
  );
}
