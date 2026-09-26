import Link from "next/link";
import { ShieldOff, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { WEBHOOK_EVENTS, WEBHOOK_PROVIDERS } from "@/lib/webhooks";
import { formatDate, formatNumber, truncate } from "@/lib/utils";
import { PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { ActionButton } from "@/components/admin/action-button";
import { Table, Ids } from "@/components/admin/table";
import { bulkWebhookLogs, disableFailingWebhooks, purgeOldWebhookLogs, webhookLogQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminWebhookLogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const state = qs(sp, "state"), event = qs(sp, "event"), provider = qs(sp, "provider"), user = qs(sp, "user"), q = qs(sp, "q");
  const { page, perPage, skip, take } = paging(sp, 50);
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const where: Prisma.WebhookLogWhereInput = {
    ...(state === "success" ? { success: true } : state === "failed" ? { success: false } : state === "retrying" ? { success: false, nextRetryAt: { not: null } } : {}),
    ...(event ? { event } : {}),
    ...(provider || user || q ? { webhook: {
      ...(provider ? { provider } : {}),
      ...(user ? { user: { OR: [{ username: { contains: user } }, { email: { contains: user } }] } } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { url: { contains: q } }] } : {}),
    } } : {}),
  };
  const [logs, total, total24h, failed24h, pendingRetries, failingHooks, inactiveHooks] = await Promise.all([
    db.webhookLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { webhook: { select: { id: true, name: true, url: true, provider: true, active: true, failures: true, user: { select: { id: true, username: true } } } } } }),
    db.webhookLog.count({ where }),
    db.webhookLog.count({ where: { createdAt: { gte: since24h } } }),
    db.webhookLog.count({ where: { createdAt: { gte: since24h }, success: false } }),
    db.webhookLog.count({ where: { success: false, nextRetryAt: { not: null } } }),
    db.webhook.count({ where: { active: true, failures: { gte: 5 } } }),
    db.webhook.count({ where: { active: false } }),
  ]);
  const successRate = total24h ? Math.round(((total24h - failed24h) / total24h) * 100) : 100;

  return (
    <div>
      <PageHeader title="Webhook logs" description={`${formatNumber(total)} deliveries · Zapier, Slack, Discord and custom endpoints across all accounts`}
        actions={<>
          <ActionButton action={purgeOldWebhookLogs} confirm="Delete successful entries older than 30 days?"><Trash2 size={14} /> Purge old entries</ActionButton>
          <ActionButton action={disableFailingWebhooks} hidden={{ threshold: "5" }} variant="danger" confirm={`Disable every active webhook with 5 or more consecutive failures (${failingHooks} affected)?`}><ShieldOff size={14} /> Disable failing webhooks ({failingHooks})</ActionButton>
        </>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Deliveries (24h)" value={formatNumber(total24h)} sub={`${formatNumber(failed24h)} failed`} />
        <Stat label="Success rate (24h)" value={<span className={successRate < 90 ? "text-warning" : "text-success"}>{successRate}%</span>} />
        <Stat label="Awaiting retry" value={formatNumber(pendingRetries)} sub="picked up by the cron retry job" />
        <Stat label="Failing webhooks" value={<span className={failingHooks ? "text-danger" : ""}>{formatNumber(failingHooks)}</span>} sub={`${formatNumber(inactiveHooks)} disabled`} />
      </div>
      <FilterBar fields={[
        { name: "state", type: "select", value: state, options: [{ value: "", label: "All deliveries" }, { value: "success", label: "Successful" }, { value: "failed", label: "Failed" }, { value: "retrying", label: "Awaiting retry" }] },
        { name: "event", type: "select", value: event, options: [{ value: "", label: "All events" }, ...WEBHOOK_EVENTS.map((e) => ({ value: e.value, label: e.label }))] },
        { name: "provider", type: "select", value: provider, options: [{ value: "", label: "All providers" }, ...WEBHOOK_PROVIDERS.map((p) => ({ value: p.value, label: p.label }))] },
        { name: "user", value: user, placeholder: "Owner username or email" },
        { name: "q", value: q, placeholder: "Webhook name or URL" },
      ]} />
      <BulkForm action={bulkWebhookLogs} options={[{ value: "retry", label: "Retry now" }, { value: "delete", label: "Delete" }]}>
        <Table count={logs.length} empty="No webhook deliveries match these filters." head={["", "Time", "Owner", "Webhook", "Event", "HTTP", "Attempts", "Result", "Response", ""]}>
          {logs.map((l) => (
            <tr key={l.id}>
              <td><Ids id={l.id} /></td>
              <td className="text-muted text-xs whitespace-nowrap">{formatDate(l.createdAt, true)}{l.nextRetryAt && !l.success && <span className="block text-[11px]">retry {formatDate(l.nextRetryAt, true)}</span>}</td>
              <td><Link href={`/admin/users/${l.webhook.user.id}`}>{l.webhook.user.username}</Link></td>
              <td><span className="font-medium">{l.webhook.name}</span><span className="block text-xs text-muted"><span className="badge-gray mr-1">{l.webhook.provider}</span>{!l.webhook.active && <span className="badge-yellow mr-1">disabled</span>}<span className="font-mono truncate inline-block max-w-[14rem] align-bottom" title={l.webhook.url}>{l.webhook.url}</span></span></td>
              <td><code className="font-mono text-xs">{l.event}</code></td>
              <td className="font-mono text-xs">{l.status ?? <span className="text-muted">-</span>}</td>
              <td>{l.attempts}</td>
              <td>{l.success ? <span className="badge-green">delivered</span> : <span className="badge-red">failed</span>}</td>
              <td className="max-w-[16rem]"><code className="text-[11px] text-muted font-mono block truncate" title={l.response ?? ""}>{l.response ? truncate(l.response, 80) : ""}</code></td>
              <td className="whitespace-nowrap space-x-1">
                <RowAction action={webhookLogQuick} hidden={{ id: l.id, op: "retry" }} variant={l.success ? "secondary" : "primary"}>Retry</RowAction>
                <RowAction action={webhookLogQuick} hidden={{ id: l.id, op: "delete" }} variant="ghost" confirm="Delete this log entry?">Delete</RowAction>
              </td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/webhook-logs", sp)} />
    </div>
  );
}
