import { adminPage } from "@/lib/admin/guard";
import { systemInfo, tableCounts, formatBytes, TABLE_NAMES } from "@/lib/admin/system";
import { getSettings } from "@/lib/settings";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, CheckboxGroup } from "@/components/admin/fields";
import { clearAllCache, cleanup, recountClicks, resetDemoData } from "./actions";

export default async function ToolsAdmin() {
  await adminPage("tools.manage");
  const [info, counts, s] = await Promise.all([systemInfo(), tableCounts(), getSettings()]);
  const envKeys = ["APP_URL", "NEXTAUTH_URL", "DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "SMTP_HOST", "GOOGLE_CLIENT_ID", "STRIPE_SECRET_KEY", "OPENAI_API_KEY"];
  return (
    <div>
      <PageHeader title="Tools & Cache" description="Maintenance utilities, database information and runtime details." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Cache" description="Clears settings & translation caches and revalidates every rendered page.">
          <ActionButton action={clearAllCache} variant="primary" size={undefined}>Clear cache</ActionButton>
          <p className="hint mt-2">Cache driver: {s["cache.driver"]} · TTL {s["cache.ttl"]}s</p>
        </Card>
        <Card title="Recount statistics" description="Recomputes link clicks/unique clicks, bio views and QR scans from the click log.">
          <ActionButton action={recountClicks} variant="secondary" size={undefined} confirm="Recount all counters from click records?">Recount clicks</ActionButton>
        </Card>
        <Card title="Cleanup" description="Free up space by deleting old data. Enter the age in days and choose what to purge." className="lg:col-span-2">
          <div id="cleanup" className="grid md:grid-cols-2 gap-4">
            {[
              ["zeroClickLinks", "Links older than N days with 0 clicks", "Pinned links are kept."], ["anonymousLinks", "Anonymous links older than N days", ""],
              ["oldClicks", "Click records older than N days", "Statistics for that period disappear."], ["retentionClicks", "Clicks beyond each plan's retention", "Uses statsRetentionDays of the owner's plan (N ignored)."],
              ["expiredLinks", "Expired anonymous links", "N ignored."], ["notifications", "Read notifications older than N days", ""], ["loginHistory", "Login history older than N days", ""],
            ].map(([op, label, hint]) => (
              <ActionForm key={op} action={cleanup} hidden={{ op }} submitLabel="Run" variant="danger" confirm={`${label}: this permanently deletes data. Continue?`} className="flex items-end gap-2 [&>div:last-child]:mb-0 border border-border rounded-lg p-3">
                <div className="flex-1"><p className="text-sm font-medium">{label}</p>{hint && <p className="hint">{hint}</p>}</div>
                <Input name="days" type="number" defaultValue={90} min={1} className="w-24" />
              </ActionForm>
            ))}
          </div>
        </Card>
        <Card title="Database">
          <dl className="text-sm grid grid-cols-2 gap-y-1"><dt className="text-muted">Provider</dt><dd>{info.db}</dd><dt className="text-muted">Size</dt><dd>{info.dbBytes !== null ? formatBytes(info.dbBytes) : "n/a (managed server)"}</dd></dl>
          <table className="table mt-3 text-xs"><tbody>{TABLE_NAMES.map((t) => <tr key={t}><td className="text-muted">{t}</td><td className="text-right">{counts[t].toLocaleString()}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Export data" description="Download selected tables as JSON (max 10,000 rows per table).">
          <form method="get" action="/api/admin/export" className="space-y-3">
            <CheckboxGroup name="tables" options={TABLE_NAMES.map((t) => ({ value: t, label: t }))} defaultValues={["user", "link"]} columns={2} />
            <button className="btn-secondary">Download JSON</button>
          </form>
        </Card>
        <Card title="System information" className="lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-muted">App version</dt><dd>{info.version}</dd><dt className="text-muted">Node.js</dt><dd>{info.node}</dd><dt className="text-muted">Platform</dt><dd>{info.platform}</dd>
              <dt className="text-muted">Environment</dt><dd>{info.env}</dd><dt className="text-muted">Timezone</dt><dd>{info.timezone}</dd><dt className="text-muted">Working dir</dt><dd className="truncate">{info.cwd}</dd>
              <dt className="text-muted">Memory (RSS)</dt><dd>{formatBytes(info.memory)}</dd><dt className="text-muted">Uptime</dt><dd>{Math.round(info.uptime / 60)} min</dd><dt className="text-muted">Uploads</dt><dd>{info.uploads.files} files · {formatBytes(info.uploads.bytes)}</dd>
            </dl>
            <div>
              <p className="font-medium mb-1">Environment variables</p>
              <dl className="grid grid-cols-2 gap-y-1 text-xs">{envKeys.map((k) => <div key={k} className="contents"><dt className="text-muted font-mono">{k}</dt><dd>{process.env[k] ? <span className="badge-green">set</span> : <span className="badge-gray">missing</span>}</dd></div>)}</dl>
              <p className="font-medium mt-3 mb-1">Runtime</p>
              <dl className="grid grid-cols-2 gap-y-1 text-xs"><dt className="text-muted">Next.js</dt><dd>15</dd><dt className="text-muted">React</dt><dd>19</dd><dt className="text-muted">Prisma</dt><dd>6</dd><dt className="text-muted">V8</dt><dd>{process.versions.v8}</dd><dt className="text-muted">OpenSSL</dt><dd>{process.versions.openssl}</dd><dt className="text-muted">PID</dt><dd>{process.pid}</dd></dl>
            </div>
          </div>
        </Card>
        <Card title="Reset demo data" description="Deletes links, clicks, bio pages, QR codes, campaigns, payments, subscriptions, tickets, reports, contacts and notifications. Optionally users (except you). Irreversible." className="lg:col-span-2 border-danger/40">
          <ActionForm action={resetDemoData} submitLabel="Reset data" variant="danger" confirm="This will permanently wipe the data listed. Are you absolutely sure?" className="max-w-md">
            <Input label='Type "RESET" to confirm' name="confirm" placeholder="RESET" required />
            <SwitchField name="keepUsers" label="Keep user accounts" defaultChecked />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
