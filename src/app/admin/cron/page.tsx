import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { appUrl, formatDate } from "@/lib/utils";
import { Alert, Card, CopyButton, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { runCronNow, clearCronLogs } from "./actions";

const JOBS: { job: string; label: string; schedule: string; description: string }[] = [
  { job: "expire-plans", label: "Expire plans", schedule: "0 * * * *", description: "Downgrades users whose paid plan or trial ended and emails them." },
  { job: "expire-links", label: "Expire links", schedule: "*/30 * * * *", description: "Removes expired anonymous links; expired user links show their expired page." },
  { job: "cleanup", label: "Cleanup", schedule: "0 3 * * *", description: "Deletes old clicks beyond plan retention, stale tokens, old notifications and inactive links (links.cleanupDays)." },
  { job: "subscriptions", label: "Subscriptions", schedule: "0 */6 * * *", description: "Syncs subscription statuses with gateways and marks past-due/cancelled ones." },
  { job: "notify-expiring", label: "Notify expiring", schedule: "0 9 * * *", description: "Emails users whose plan expires in the next days." },
  { job: "imports", label: "Process imports", schedule: "* * * * *", description: "Processes pending CSV import jobs in the background." },
  { job: "reset-ai-credits", label: "Reset AI credits", schedule: "0 0 1 * *", description: "Resets monthly AI credit counters." },
  { job: "storage-sync", label: "Storage sync", schedule: "0 4 * * *", description: "Uploads local files to the configured object storage." },
  { job: "health", label: "Link health monitor", schedule: "*/15 * * * *", description: "Checks destination URLs of the least-recently-checked links, flags broken ones and alerts owners." },
  { job: "alerts", label: "Traffic alerts", schedule: "*/10 * * * *", description: "Click-threshold and spike detection notifications." },
  { job: "reports", label: "Email reports", schedule: "0 6 * * *", description: "Sends weekly (Monday) and monthly (1st) performance digests to users who opted in." },
  { job: "webhook-retry", label: "Webhook retries", schedule: "*/5 * * * *", description: "Re-sends failed webhook deliveries with exponential backoff." },
  { job: "tempmail", label: "Temp mail purge", schedule: "*/10 * * * *", description: "Deletes expired temporary mailboxes and their messages." },
  { job: "reminders", label: "Link reminders", schedule: "0 8 * * *", description: "Reminds owners about links expiring within 3 days and scheduled links going live today." },
];

export default async function CronAdmin() {
  await adminPage("tools.manage");
  const secret = process.env.CRON_SECRET ?? "";
  const [logs, lastRuns] = await Promise.all([db.cronLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }), db.cronLog.groupBy({ by: ["job"], _max: { createdAt: true } })]);
  const last = new Map(lastRuns.map((r) => [r.job, r._max.createdAt]));
  const masked = secret ? secret.slice(0, 3) + "…" + secret.slice(-2) : "(not set)";
  const crontab = JOBS.map((j) => `${j.schedule} curl -s -H "Authorization: Bearer $CRON_SECRET" ${appUrl(`/api/cron/${j.job}`)} > /dev/null`).join("\n");
  return (
    <div>
      <PageHeader title="Cron jobs" description="Scheduled maintenance tasks. Call each URL from your server's crontab (or a scheduler like Vercel Cron / GitHub Actions)." actions={<ActionButton action={clearCronLogs} confirm="Delete all cron logs?" size={undefined}>Clear logs</ActionButton>} />
      {!secret && <div className="mb-4"><Alert type="warning">CRON_SECRET is not set in .env — the cron endpoints will reject requests until it is configured.</Alert></div>}
      <Card title="Jobs" description={`Authenticate with header Authorization: Bearer CRON_SECRET (current: ${masked}). Alternatively append ?secret=…`}>
        <Table count={JOBS.length} head={["Job", "Suggested schedule", "URL", "Last run", ""]}>
          {JOBS.map((j) => {
            const url = appUrl(`/api/cron/${j.job}`);
            const lr = last.get(j.job);
            return <tr key={j.job}><td><span className="font-medium">{j.label}</span><span className="block text-xs text-muted max-w-xs">{j.description}</span></td><td className="font-mono text-xs">{j.schedule}</td><td><div className="flex items-center gap-1"><code className="text-xs">{url}</code><CopyButton text={url} /></div></td><td className="text-xs text-muted">{lr ? formatDate(lr, true) : "never"}</td><td><ActionButton action={runCronNow} hidden={{ job: j.job }} variant="primary">Run now</ActionButton></td></tr>;
          })}
        </Table>
      </Card>
      <Card title="Example crontab" className="mt-6" actions={<CopyButton text={crontab} />}>
        <pre className="text-xs overflow-auto bg-bg rounded-lg p-3">{`CRON_SECRET=${secret ? "your-secret" : "set-me"}\n${crontab}`}</pre>
        <p className="hint mt-2">Alternatively run <code>pnpm cron</code> as a long-lived process which schedules all jobs internally.</p>
      </Card>
      <Card title="Recent runs" className="mt-6">
        <Table count={logs.length} head={["Job", "Status", "Message", "Date"]}>
          {logs.map((l) => <tr key={l.id}><td className="font-mono text-xs">{l.job}</td><td><StatusBadge value={l.status === "ok" ? "completed" : l.status} /></td><td className="text-xs text-muted max-w-lg truncate">{l.message}</td><td className="text-xs">{formatDate(l.createdAt, true)}</td></tr>)}
        </Table>
      </Card>
    </div>
  );
}
