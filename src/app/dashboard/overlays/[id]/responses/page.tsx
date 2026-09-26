import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { parseOverlayOptions, overlayTypeLabel } from "@/components/overlays/overlay-types";
import { formatDate, json } from "@/lib/utils";
import { PageHeader, Card, Empty, Badge, Button, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { TopList } from "@/components/ui/charts";
import { ConfirmForm } from "@/components/ui/confirm";
import { deleteOverlayResponse, clearOverlayResponses } from "../../actions";
import { ArrowLeft, Download, Trash2 } from "lucide-react";

export const metadata = { title: "Overlay responses" };
const PER_PAGE = 50;

export default async function OverlayResponsesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const overlay = await db.overlay.findFirst({ where: { id, userId: ws.ownerId } });
  if (!overlay) notFound();
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const [total, rows, all] = await Promise.all([
    db.overlayResponse.count({ where: { overlayId: id } }),
    db.overlayResponse.findMany({ where: { overlayId: id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    overlay.type === "poll" ? db.overlayResponse.findMany({ where: { overlayId: id }, select: { data: true } }) : Promise.resolve([]),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  const canEdit = can(ws, "overlays", "edit");
  const opts = parseOverlayOptions(overlay.options);
  const columns = overlay.type === "poll" ? ["answer"] : overlay.type === "newsletter" ? ["email"] : (opts.formFields?.length ? opts.formFields : ["name", "email", "message"]);
  let pollResults: { label: string; count: number }[] = [];
  if (overlay.type === "poll") {
    const counts = new Map<string, number>();
    for (const o of opts.pollOptions ?? []) counts.set(o, 0);
    for (const r of all) { const a = json<Record<string, string>>(r.data, {}).answer ?? "Unknown"; counts.set(a, (counts.get(a) ?? 0) + 1); }
    pollResults = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }
  return (
    <div>
      <Link href={`/dashboard/overlays/${overlay.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-3"><ArrowLeft size={14} />Back to overlay</Link>
      <PageHeader title={<span className="flex items-center gap-2">{overlay.name} — responses<Badge color="blue">{overlayTypeLabel(overlay.type)}</Badge></span>} description={`${total} response${total === 1 ? "" : "s"} collected`}
        actions={<>
          {total > 0 && <a href={`/dashboard/overlays/${overlay.id}/responses/export`} className="btn-secondary btn-sm"><Download size={14} />Export CSV</a>}
          {canEdit && total > 0 && <ConfirmForm action={clearOverlayResponses} hidden={{ overlayId: overlay.id }} message="Delete ALL responses for this overlay? This cannot be undone."><Button type="submit" variant="danger" size="sm"><Trash2 size={14} />Clear all</Button></ConfirmForm>}
        </>} />
      {overlay.type === "poll" && (
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Stat label="Total votes" value={total} />
          <Card title={overlay.title || "Poll results"} className="md:col-span-2"><TopList data={pollResults} total={total} /></Card>
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <Empty title="No responses yet" description="Responses submitted through this overlay will appear here." />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}<th>IP</th><th>Date</th>{canEdit && <th></th>}</tr></thead>
              <tbody>
                {rows.map((r) => {
                  const d = json<Record<string, string>>(r.data, {});
                  return (
                    <tr key={r.id}>
                      {columns.map((c) => <td key={c} className={c === "message" ? "max-w-md whitespace-pre-wrap" : ""}>{d[c] ?? <span className="text-muted">—</span>}</td>)}
                      <td className="text-muted font-mono text-xs">{r.ip ?? "—"}</td>
                      <td className="text-muted">{formatDate(r.createdAt, true)}</td>
                      {canEdit && <td className="text-right"><ConfirmForm action={deleteOverlayResponse} hidden={{ id: r.id }} message="Delete this response?"><Button type="submit" variant="ghost" size="sm" className="text-danger"><Trash2 size={14} /></Button></ConfirmForm></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pages={pages} hrefFor={(p) => `/dashboard/overlays/${overlay.id}/responses?page=${p}`} />
    </div>
  );
}
