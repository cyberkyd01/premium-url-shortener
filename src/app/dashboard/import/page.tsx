import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { formatDate, json } from "@/lib/utils";
import { PageHeader, Card, Alert, Badge, Empty } from "@/components/ui";
import { ImportForm } from "@/components/links/import-form";

export const metadata = { title: "Import / Export" };

export default async function ImportPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { user, features } = await getUserPlan(ws.ownerId);
  const isAdmin = user.role === "admin";
  const canImport = isAdmin || features.import;
  const canExport = isAdmin || features.export;
  const jobs = await db.importJob.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, take: 20 });
  const linkCount = await db.link.count({ where: { userId: ws.ownerId } });
  return (
    <>
      <PageHeader title="Import / Export" description="Bulk import links from CSV and export your data." />
      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card title="Import links from CSV" className="lg:col-span-2">
          {!can(ws, "links", "create") ? <Alert type="error">You do not have permission to create links in this team.</Alert>
            : canImport ? <ImportForm /> : <Alert type="warning">CSV import is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to unlock it.</Alert>}
          <p className="hint mt-4">Example: <code>url,alias,title,domain,channel</code> → <code>https://example.com/page,my-alias,My page,,Marketing</code></p>
        </Card>
        <Card title="Export all links" description={`${linkCount} links in this workspace`}>
          {canExport ? <a href="/api/links/export" className="btn-primary"><Download size={14} /> Download CSV</a> : <Alert type="warning">Export is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link>.</Alert>}
          <p className="hint mt-3">Includes short URL, destination, title, clicks, status, channel, campaign and dates.</p>
        </Card>
      </div>
      <Card title="Past imports">
        {jobs.length === 0 ? <Empty title="No imports yet" /> : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>File</th><th>Date</th><th className="text-right">Rows</th><th className="text-right">Imported</th><th className="text-right">Failed</th><th>Status</th></tr></thead>
            <tbody>{jobs.map((j) => { const errs = json<{ row: number; error: string }[]>(j.errors, []); return (
              <tr key={j.id}>
                <td className="font-medium">{j.filename}</td><td className="text-muted text-xs whitespace-nowrap">{formatDate(j.createdAt, true)}</td>
                <td className="text-right">{j.total}</td><td className="text-right">{j.processed}</td>
                <td className="text-right">{j.failed}{errs.length > 0 && <details className="text-xs text-left"><summary className="cursor-pointer text-muted">details</summary><ul className="mt-1 space-y-0.5">{errs.slice(0, 20).map((e) => <li key={e.row}>Row {e.row}: {e.error}</li>)}</ul></details>}</td>
                <td><Badge color={j.status === "done" ? "green" : j.status === "failed" ? "red" : "yellow"}>{j.status}</Badge></td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
