import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Puzzle } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { WEBHOOK_PROVIDERS } from "@/lib/webhooks";
import { formatDate, json, truncate } from "@/lib/utils";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { ClearLogsButton, HookButtons, RetryButton } from "./log-actions";

export const metadata = { title: "Webhook deliveries" };
const PER_PAGE = 40;

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const hooks = await db.webhook.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { logs: true } } } });
  const where: Prisma.WebhookLogWhereInput = { webhook: { userId: ws.ownerId } };
  if (sp.hook) where.webhookId = sp.hook;
  if (sp.status === "failed") where.success = false;
  if (sp.status === "ok") where.success = true;
  if (sp.event) where.event = sp.event;
  const [total, logs] = await Promise.all([
    db.webhookLog.count({ where }),
    db.webhookLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { webhook: { select: { name: true, provider: true } } } }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  const hrefFor = (p: number) => { const u = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1])); u.set("page", String(p)); return `/dashboard/webhooks?${u}`; };
  const providerLabel = (p: string) => WEBHOOK_PROVIDERS.find((x) => x.value === p)?.label ?? p;

  return (
    <>
      <PageHeader title="Webhook deliveries" description="Every delivery attempt with its status, retries and the endpoint's response." actions={<><Link href="/dashboard/tools" className="btn-secondary btn-sm"><Puzzle size={14} /> Manage webhooks</Link>{total > 0 && <ClearLogsButton webhookId={sp.hook} />}</>} />

      <Card title="Your webhooks" description="Slack, Discord, Telegram, Microsoft Teams, Zapier and custom endpoints. Webhooks are disabled automatically after 20 consecutive failures." className="mb-6">
        {hooks.length === 0 ? <Empty title="No webhooks yet" description="Create one under Integrations to receive events in your tools." action={<Link href="/dashboard/tools" className="btn-primary">Open integrations</Link>} /> : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>Name</th><th>Provider</th><th>Events</th><th>Status</th><th className="text-right">Failures</th><th>Last call</th><th className="text-right">Deliveries</th><th></th></tr></thead>
            <tbody>{hooks.map((h) => (
              <tr key={h.id}>
                <td className="font-medium"><Link href={`/dashboard/webhooks?hook=${h.id}`} className="text-primary">{h.name}</Link><p className="text-xs text-muted truncate max-w-xs" title={h.url}>{truncate(h.url, 50)}</p></td>
                <td>{providerLabel(h.provider)}</td>
                <td className="text-xs text-muted">{json<string[]>(h.events, []).join(", ")}</td>
                <td>{h.active ? <Badge color="green">Active</Badge> : <Badge color="red">Disabled</Badge>}</td>
                <td className="text-right">{h.failures}</td>
                <td className="text-xs text-muted whitespace-nowrap">{h.lastCalledAt ? formatDate(h.lastCalledAt, true) : "never"}</td>
                <td className="text-right">{h._count.logs}</td>
                <td><HookButtons webhookId={h.id} active={h.active} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <form method="get" className="card p-4 mb-4 grid gap-3 md:grid-cols-5 text-sm">
        <select name="hook" defaultValue={sp.hook ?? ""} className="input"><option value="">All webhooks</option>{hooks.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Any status</option><option value="ok">Delivered</option><option value="failed">Failed</option></select>
        <input name="event" defaultValue={sp.event ?? ""} className="input" placeholder="Event (e.g. link.clicked)" />
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button><Link href="/dashboard/webhooks" className="btn-ghost btn-sm">Reset</Link></div>
      </form>

      <Card title={`Delivery log (${total})`}>
        {logs.length === 0 ? <Empty title="No deliveries yet" description="Deliveries appear here as events are triggered." /> : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>Time</th><th>Webhook</th><th>Event</th><th>Provider</th><th>Status</th><th className="text-right">Attempts</th><th>Response</th><th>Next retry</th><th></th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id}>
                <td className="text-xs text-muted whitespace-nowrap">{formatDate(l.createdAt, true)}</td>
                <td className="font-medium">{l.webhook.name}</td>
                <td><span className="badge-gray">{l.event}</span></td>
                <td>{providerLabel(l.webhook.provider)}</td>
                <td>{l.success ? <Badge color="green">{l.status ? `HTTP ${l.status}` : "OK"}</Badge> : <Badge color="red">{l.status ? `HTTP ${l.status}` : "Failed"}</Badge>}</td>
                <td className="text-right">{l.attempts}</td>
                <td className="text-xs text-muted max-w-xs truncate" title={l.response ?? ""}>{l.response ? truncate(l.response, 60) : "-"}</td>
                <td className="text-xs text-muted whitespace-nowrap">{l.success ? "-" : l.nextRetryAt ? formatDate(l.nextRetryAt, true) : "gave up"}</td>
                <td>{!l.success && <RetryButton logId={l.id} />}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
