import Link from "next/link";
import { redirect } from "next/navigation";
import * as Icons from "lucide-react";
import { getWorkspace } from "@/lib/workspace";
import { ACTIVITY_ACTIONS, listActivity, syncLoginActivity } from "@/lib/activity";
import { formatDate, json, truncate } from "@/lib/utils";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Activity log" };
const PER_PAGE = 50;

function ActionIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] ?? Icons.Activity;
  return <Icon size={15} />;
}

function describe(action: string, target: string | null, targetId: string | null, meta: Record<string, unknown>) {
  const alias = typeof meta.alias === "string" ? meta.alias : null;
  const url = typeof meta.url === "string" ? meta.url : null;
  if (action.startsWith("link.")) {
    const label = alias ? `/${alias}` : targetId ? `#${targetId.slice(0, 8)}` : "";
    if (action === "link.bulk") return `${String(meta.action ?? "bulk")} on ${String(meta.count ?? "?")} links${meta.value ? ` (${String(meta.value)})` : ""}`;
    if (action === "link.delete" && meta.count) return `${String(meta.count)} links deleted`;
    return `${label}${url ? ` → ${truncate(url, 60)}` : ""}`;
  }
  if (action.startsWith("login")) return [meta.country, meta.userAgent ? truncate(String(meta.userAgent), 50) : null].filter(Boolean).map(String).join(" · ");
  if (action === "migration.run") return `${String(meta.source ?? "")}: ${String(meta.imported ?? 0)} imported, ${String(meta.skipped ?? 0)} skipped`;
  return [target, targetId ? `#${targetId.slice(0, 8)}` : null].filter(Boolean).join(" ");
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  if (!ws.isTeam) await syncLoginActivity(ws.ownerId);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const filter = { action: sp.action || undefined, from: sp.from || undefined, to: sp.to || undefined };
  const { total, rows, pages } = await listActivity(ws.ownerId, filter, page, PER_PAGE);
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1] && e[0] !== "page"));
  const hrefFor = (p: number) => { const u = new URLSearchParams(qs); u.set("page", String(p)); return `/dashboard/activity?${u}`; };
  const groups: { label: string; value: string }[] = [
    { label: "All links events", value: "link." }, { label: "Logins", value: "login" }, ...Object.entries(ACTIVITY_ACTIONS).map(([value, a]) => ({ label: a.label, value })),
  ];
  let lastDay = "";
  return (
    <>
      <PageHeader title="Activity log" description={`${total} event${total === 1 ? "" : "s"} in this workspace`} actions={<a href={`/dashboard/activity/export?${qs}`} className="btn-secondary btn-sm"><Icons.Download size={14} /> Export CSV</a>} />
      <form method="get" className="card p-4 mb-4 grid gap-3 md:grid-cols-4 text-sm">
        <select name="action" defaultValue={sp.action ?? ""} className="input"><option value="">Any action</option>{groups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="input" title="From" />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="input" title="Until" />
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button><Link href="/dashboard/activity" className="btn-ghost btn-sm">Reset</Link></div>
      </form>
      <Card>
        {rows.length === 0 ? <Empty title="No activity yet" description="Actions on your links and logins will show up here." /> : (
          <ol className="space-y-1">
            {rows.map((r) => {
              const a = ACTIVITY_ACTIONS[r.action] ?? { label: r.action, icon: "Activity", color: "gray" as const };
              const meta = json<Record<string, unknown>>(r.meta, {});
              const day = formatDate(r.createdAt);
              const header = day !== lastDay; lastDay = day;
              return (
                <li key={r.id}>
                  {header && <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mt-4 mb-2 first:mt-0">{day}</p>}
                  <div className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-bg">
                    <span className={`mt-0.5 h-7 w-7 shrink-0 rounded-full grid place-items-center badge-${a.color}`}><ActionIcon name={a.icon} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm"><span className="font-medium">{a.label}</span>{r.actorId && r.actorId !== r.userId && <span className="text-xs text-muted"> · by team member</span>}{r.isAdmin && <Badge color="yellow">admin</Badge>}</p>
                      <p className="text-xs text-muted truncate">{describe(r.action, r.target, r.targetId, meta)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted whitespace-nowrap">{r.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                      {r.ip && <p className="text-[11px] text-muted font-mono">{r.ip}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
