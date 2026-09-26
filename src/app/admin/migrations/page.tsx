import Link from "next/link";
import { Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate, formatNumber, json } from "@/lib/utils";
import { PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge, Ids } from "@/components/admin/table";
import { bulkMigrations, migrationQuick, purgeOldMigrations } from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface LogRow { row: number; alias?: string; url: string; status: "imported" | "skipped"; error?: string }

function isLogRow(v: unknown): v is LogRow {
  return typeof v === "object" && v !== null && typeof (v as { url?: unknown }).url === "string" && typeof (v as { status?: unknown }).status === "string";
}

export default async function AdminMigrationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const status = qs(sp, "status"), source = qs(sp, "source"), user = qs(sp, "user");
  const { page, perPage, skip, take } = paging(sp);
  let userIds: string[] | null = null;
  if (user) {
    const users = await db.user.findMany({ where: { OR: [{ username: { contains: user } }, { email: { contains: user } }, { id: user }] }, select: { id: true }, take: 200 });
    userIds = users.map((u) => u.id);
  }
  const where: Prisma.MigrationJobWhereInput = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(userIds ? { userId: { in: userIds } } : {}),
  };
  const [jobs, total, all, sums, sources, statuses] = await Promise.all([
    db.migrationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.migrationJob.count({ where }),
    db.migrationJob.count(),
    db.migrationJob.aggregate({ _sum: { total: true, imported: true, skipped: true } }),
    db.migrationJob.groupBy({ by: ["source"], _count: { _all: true } }),
    db.migrationJob.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const ownerIds = Array.from(new Set(jobs.map((j) => j.userId)));
  const owners = ownerIds.length ? await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, username: true } }) : [];
  const ownerOf = (id: string) => owners.find((o) => o.id === id);
  const running = statuses.filter((s) => s.status === "pending" || s.status === "running").reduce((n, s) => n + s._count._all, 0);

  return (
    <div>
      <PageHeader title="Migrations" description={`${formatNumber(all)} import jobs from Bitly, Rebrandly and CSV files`}
        actions={<ActionButton action={purgeOldMigrations} confirm="Delete finished jobs older than 90 days? Imported links are kept."><Trash2 size={14} /> Purge old jobs</ActionButton>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Jobs" value={formatNumber(all)} sub={running ? <span className="text-warning">{running} in progress</span> : "none in progress"} />
        <Stat label="Rows processed" value={formatNumber(sums._sum.total ?? 0)} />
        <Stat label="Links imported" value={<span className="text-success">{formatNumber(sums._sum.imported ?? 0)}</span>} />
        <Stat label="Rows skipped" value={formatNumber(sums._sum.skipped ?? 0)} sub="duplicates, invalid URLs or plan limits" />
      </div>
      <FilterBar fields={[
        { name: "source", type: "select", value: source, options: [{ value: "", label: "All sources" }, ...sources.map((s) => ({ value: s.source, label: `${s.source} (${s._count._all})` }))] },
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, ...statuses.map((s) => ({ value: s.status, label: `${s.status} (${s._count._all})` }))] },
        { name: "user", value: user, placeholder: "Owner username, email or id" },
      ]} />
      <BulkForm action={bulkMigrations} options={[{ value: "delete", label: "Delete" }]}>
        <Table count={jobs.length} empty="No migration jobs match these filters." head={["", "Started", "User", "Source", "Rows", "Imported", "Skipped", "Status", "Log preview", ""]}>
          {jobs.map((j) => {
            const owner = ownerOf(j.userId);
            const log = json<unknown[]>(j.log, []).filter(isLogRow);
            const errors = log.filter((r) => r.status === "skipped" && r.error);
            const firstErrors = errors.slice(0, 2);
            return (
              <tr key={j.id}>
                <td><Ids id={j.id} /></td>
                <td className="text-muted text-xs whitespace-nowrap">{formatDate(j.createdAt, true)}</td>
                <td>{owner ? <Link href={`/admin/users/${owner.id}`}>{owner.username}</Link> : <span className="text-muted font-mono text-xs">{j.userId}</span>}</td>
                <td><span className="badge-blue">{j.source}</span></td>
                <td>{formatNumber(j.total)}</td>
                <td className="text-success">{formatNumber(j.imported)}</td>
                <td className={j.skipped ? "text-warning" : ""}>{formatNumber(j.skipped)}</td>
                <td><StatusBadge value={j.status} /></td>
                <td className="max-w-xs">
                  {log.length === 0 ? <span className="text-xs text-muted">no log</span> : (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted">{log.length} row{log.length === 1 ? "" : "s"}{errors.length ? ` · ${errors.length} error${errors.length === 1 ? "" : "s"}` : ""}</summary>
                      <ul className="mt-1 space-y-0.5 font-mono">
                        {(firstErrors.length ? firstErrors : log.slice(0, 3)).map((r) => <li key={r.row} className="truncate" title={`${r.url}${r.error ? ` — ${r.error}` : ""}`}>#{r.row} {r.status === "imported" ? <span className="text-success">imported</span> : <span className="text-danger">{r.error ?? "skipped"}</span>} {r.alias ? `/${r.alias}` : r.url}</li>)}
                        {log.length > 3 && <li className="text-muted">… {log.length - Math.max(firstErrors.length, Math.min(3, log.length))} more (full log visible to the user under Dashboard → Import)</li>}
                      </ul>
                    </details>
                  )}
                </td>
                <td className="whitespace-nowrap"><RowAction action={migrationQuick} hidden={{ id: j.id, op: "delete" }} variant="danger" confirm="Delete this migration job? Imported links are kept.">Delete</RowAction></td>
              </tr>
            );
          })}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/migrations", sp)} />
    </div>
  );
}
