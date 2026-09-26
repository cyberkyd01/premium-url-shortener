import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { formatDate, json } from "@/lib/utils";
import { PageHeader, Card, Alert, Badge, Empty } from "@/components/ui";
import { MigrateForms } from "./migrate-forms";

export const metadata = { title: "Migrate links" };

export default async function MigratePage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { user, features } = await getUserPlan(ws.ownerId);
  const isAdmin = user.role === "admin";
  const allowed = isAdmin || features.import;
  const [jobs, domains, limit] = await Promise.all([
    db.migrationJob.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.domain.findMany({ where: { status: 1, isMain: false, OR: [{ userId: ws.ownerId }, { isPublic: true }] }, orderBy: { domain: "asc" }, select: { id: true, domain: true } }),
    withinLimit(ws.ownerId, "limitLinks"),
  ]);
  const statusColor = (s: string): "green" | "yellow" | "red" | "gray" | "blue" => (s === "done" ? "green" : s === "partial" ? "yellow" : s === "running" ? "blue" : s === "failed" ? "red" : "gray");
  return (
    <>
      <PageHeader title="Migrate from another shortener" description="Move your links from Bitly, Rebrandly, TinyURL or Short.io — aliases, titles and historic clicks included." actions={<Link href="/dashboard/import" className="btn-secondary btn-sm">Generic CSV import</Link>} />
      {!can(ws, "links", "create") ? <Alert type="error">You do not have permission to create links in this team.</Alert>
        : !allowed ? <Alert type="warning">Migration is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to import links.</Alert>
        : !limit.ok ? <Alert type="warning">You have reached your plan limit of {limit.limit} links. <Link href="/dashboard/billing" className="underline">Upgrade</Link> before migrating.</Alert>
        : (
          <Card className="mb-6">
            {limit.limit > 0 && <p className="text-xs text-muted mb-3">{limit.used} / {limit.limit} links used on your plan — imports stop when the limit is reached.</p>}
            <MigrateForms domains={domains} />
          </Card>
        )}
      <Card title="Migration history">
        {jobs.length === 0 ? <Empty title="No migrations yet" /> : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>Source</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Imported</th><th className="text-right">Skipped</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>{jobs.map((j) => { const log = json<{ row: number; url: string; status: string; error?: string }[]>(j.log, []); const failed = log.filter((l) => l.status === "skipped"); return (
              <tr key={j.id}>
                <td className="capitalize font-medium">{j.source}</td>
                <td className="text-xs text-muted whitespace-nowrap">{formatDate(j.createdAt, true)}</td>
                <td className="text-right">{j.total}</td><td className="text-right text-success">{j.imported}</td><td className="text-right text-danger">{j.skipped}</td>
                <td><Badge color={statusColor(j.status)}>{j.status}</Badge></td>
                <td className="text-xs">{failed.length ? <details><summary className="cursor-pointer text-muted">{failed.length} skipped</summary><ul className="mt-1 space-y-0.5 max-h-40 overflow-auto">{failed.slice(0, 50).map((l) => <li key={l.row} className="text-muted"><span className="font-mono">#{l.row}</span> {l.url.slice(0, 50)} — <span className="text-danger">{l.error}</span></li>)}</ul></details> : "-"}</td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
