import Link from "next/link";
import { Download } from "lucide-react";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { ACTIVITY_ACTIONS } from "@/lib/activity";
import { formatDate, truncate } from "@/lib/utils";
import { PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { Table } from "@/components/admin/table";
import { readActivityFilters, activityWhere, activityQuery } from "./filters";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const filters = readActivityFilters((k) => qs(sp, k));
  const where = activityWhere(filters);
  const { page, perPage, skip, take } = paging(sp, 50);
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [rows, total, last24h, adminActions, failedLogins] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true, email: true } } } }),
    db.activityLog.count({ where }),
    db.activityLog.count({ where: { createdAt: { gte: since24h } } }),
    db.activityLog.count({ where: { isAdmin: true, createdAt: { gte: since24h } } }),
    db.activityLog.count({ where: { action: "login.failed", createdAt: { gte: since24h } } }),
  ]);
  const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id && !rows.some((r) => r.userId === id && r.user))));
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } }) : [];
  const actorName = (id: string | null) => {
    if (!id) return null;
    const fromRows = rows.find((r) => r.userId === id && r.user)?.user;
    return fromRows?.username ?? actors.find((a) => a.id === id)?.username ?? id;
  };
  const actionOptions = Array.from(new Set(Object.keys(ACTIVITY_ACTIONS).map((k) => k.split(".")[0]))).sort();
  const exportHref = `/admin/activity/export${activityQuery(filters) ? `?${activityQuery(filters)}` : ""}`;

  return (
    <div>
      <PageHeader title="Activity log" description={`${total} matching events · global audit trail across every account`} actions={<a href={exportHref} className="btn-secondary"><Download size={16} /> Export CSV</a>} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Stat label="Events (24h)" value={last24h} />
        <Stat label="Admin actions (24h)" value={adminActions} />
        <Stat label="Failed logins (24h)" value={failedLogins} sub={failedLogins > 20 ? <span className="text-warning">Unusually high – check for brute force attempts</span> : undefined} />
      </div>
      <FilterBar fields={[
        { name: "user", value: filters.user, placeholder: "Username, email or user id" },
        { name: "action", value: filters.action, placeholder: "Action prefix, e.g. link. or login" },
        { name: "admin", type: "select", value: filters.admin, options: [{ value: "", label: "All actors" }, { value: "1", label: "Admin actions only" }, { value: "0", label: "User actions only" }] },
        { name: "from", type: "date", value: filters.from }, { name: "to", type: "date", value: filters.to },
      ]}>
        <div className="flex flex-wrap gap-1 text-xs">
          {actionOptions.map((a) => <Link key={a} href={`/admin/activity?action=${encodeURIComponent(a + ".")}`} className={`badge-${filters.action.startsWith(a) ? "blue" : "gray"}`}>{a}</Link>)}
        </div>
      </FilterBar>
      <Table count={rows.length} empty="No activity matches these filters." head={["Time", "Action", "User", "Actor", "Target", "IP", "Details"]}>
        {rows.map((r) => {
          const meta = ACTIVITY_ACTIONS[r.action];
          const actor = r.actorId && r.actorId !== r.userId ? actorName(r.actorId) : null;
          return (
            <tr key={r.id}>
              <td className="text-muted whitespace-nowrap text-xs">{formatDate(r.createdAt, true)}</td>
              <td className="whitespace-nowrap"><span className={`badge-${meta?.color ?? "gray"}`}>{meta?.label ?? r.action}</span>{r.isAdmin && <span className="badge-red ml-1">admin</span>}<span className="block text-[11px] text-muted font-mono">{r.action}</span></td>
              <td>{r.user ? <Link href={`/admin/users/${r.user.id}`} className="font-medium">{r.user.username}</Link> : <span className="text-muted">{r.userId ? "deleted user" : "anonymous"}</span>}</td>
              <td className="text-sm">{actor ? <Link href={`/admin/users/${r.actorId}`}>{actor}</Link> : <span className="text-muted">-</span>}</td>
              <td className="text-xs">{r.target ? <><span className="font-mono">{r.target}</span>{r.targetId && (r.target === "link" ? <Link href={`/admin/links/${r.targetId}`} className="block text-primary font-mono">{r.targetId}</Link> : <span className="block text-muted font-mono">{r.targetId}</span>)}</> : <span className="text-muted">-</span>}</td>
              <td className="text-xs font-mono text-muted">{r.ip ?? "-"}</td>
              <td className="max-w-xs"><code className="text-[11px] text-muted font-mono block truncate" title={r.meta}>{r.meta === "{}" ? "" : truncate(r.meta, 90)}</code></td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/activity", sp)} />
    </div>
  );
}
