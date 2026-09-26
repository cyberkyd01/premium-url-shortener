import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarChart3, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getConversionStats, conversionSnippets, ATTRIBUTION_DAYS } from "@/lib/conversions";
import { shortUrl } from "@/lib/links";
import { countryName } from "@/lib/geo";
import { cn, formatDate, formatMoney, formatNumber, json } from "@/lib/utils";
import { PageHeader, Stat, Card, Alert, Badge, CopyButton } from "@/components/ui";
import { ClicksChart, TopList, DonutChart } from "@/components/ui/charts";
import { SnippetBox } from "@/components/premium/snippet-box";
import { ActionButton } from "@/components/premium/action-button";
import { deleteConversionAction } from "./actions";

export const metadata = { title: "Conversions" };
const PERIODS = [7, 30, 90];

export default async function ConversionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const days = PERIODS.includes(parseInt(sp.days ?? "", 10)) ? parseInt(sp.days!, 10) : 30;
  const link = await db.link.findFirst({ where: { id, userId: ws.ownerId }, include: { domain: true } });
  if (!link) notFound();
  if (!can(ws, "links", "stats")) return <Alert type="error">You do not have permission to view statistics in this team.</Alert>;
  const st = await getConversionStats(id, days);
  const short = shortUrl(link);
  const snippets = conversionSnippets(link.alias);
  const canEdit = can(ws, "links", "edit");

  return (
    <>
      <PageHeader title={<>Conversions <span className="text-muted font-normal">· /{link.alias}</span></>}
        description={<span className="flex flex-wrap items-center gap-2"><a href={short} target="_blank" rel="noreferrer" className="text-primary font-medium">{short}</a><CopyButton text={short} /></span>}
        actions={<Link href={`/dashboard/links/${id}`} className="btn-secondary btn-sm"><BarChart3 size={14} /> Click analytics</Link>} />

      <div className="flex gap-1 card p-1 w-fit mb-4">{PERIODS.map((d) => <Link key={d} href={`/dashboard/links/${id}/conversions?days=${d}`} className={cn("btn-sm rounded-md px-3 py-1.5 text-xs font-medium", d === days ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>{d} days</Link>)}</div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label={`Conversions (${days}d)`} value={formatNumber(st.total)} sub={`${formatNumber(link.conversions)} all time`} />
        <Stat label={`Value (${days}d)`} value={formatMoney(st.value)} sub={`${formatMoney(link.conversionValue)} all time`} />
        <Stat label="Conversion rate" value={`${(st.rate * 100).toFixed(1)}%`} sub={`${formatNumber(st.total)} conversions / ${formatNumber(st.uniqueClicks)} unique clicks`} />
        <Stat label="Avg. value" value={st.total ? formatMoney(st.value / st.total) : "-"} sub="Per conversion" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Conversions by day" className="lg:col-span-2"><ClicksChart data={st.byDay} dataKey="conversions" /></Card>
        <Card title="By goal">{st.byGoal.length ? <><DonutChart data={st.byGoal} height={160} /><ul className="mt-2 space-y-1 text-sm">{st.byGoal.map((g) => <li key={g.label} className="flex justify-between"><span><Badge color="blue">{g.label}</Badge></span><span className="text-muted">{g.count} · {formatMoney(g.value)}</span></li>)}</ul></> : <p className="text-sm text-muted">No conversions yet.</p>}</Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Recent conversions" className="lg:col-span-2">
          {st.recent.length === 0 ? <p className="text-sm text-muted">No conversions recorded yet. Install the snippet on your destination page to start tracking.</p> : (
            <div className="overflow-x-auto -m-5"><table className="table">
              <thead><tr><th>Time</th><th>Goal</th><th>Value</th><th>Country</th><th>Device</th><th>Attributed</th>{canEdit && <th className="text-right"></th>}</tr></thead>
              <tbody>{st.recent.map((c) => {
                const meta = json<{ page?: string }>(c.meta, {});
                return (
                  <tr key={c.id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(c.createdAt, true)}</td>
                    <td className="text-xs"><Badge color="blue">{c.goal}</Badge>{meta.page && <div className="text-muted truncate max-w-[12rem] mt-0.5" title={meta.page}>{meta.page.replace(/^https?:\/\//, "")}</div>}</td>
                    <td className="text-xs">{c.value ? formatMoney(c.value) : "-"}</td>
                    <td className="text-xs">{c.country ? countryName(c.country) : "Unknown"}</td>
                    <td className="text-xs text-muted">{c.device ?? "-"}</td>
                    <td className="text-xs">{c.clickId ? <Badge color="green">click</Badge> : <Badge color="gray">unattributed</Badge>}</td>
                    {canEdit && <td className="text-right"><ActionButton action={deleteConversionAction} hidden={{ id: c.id, linkId: id }} variant="ghost" confirm="Delete this conversion?" showMessage={false}><Trash2 size={12} /></ActionButton></td>}
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="By country"><TopList data={st.byCountry.map((c) => ({ label: c.label === "Unknown" ? c.label : countryName(c.label), count: c.count }))} total={st.total} /></Card>
      </div>

      <Card title="Install conversion tracking" description={`Add one of these to the page where the conversion happens (thank-you page, order confirmation, signup success). Conversions are attributed to the visitor's most recent click on this link within ${ATTRIBUTION_DAYS} days.`}>
        <div className="grid gap-5 lg:grid-cols-2">
          <SnippetBox label="1. Script tag (auto-fires on page load)" code={snippets.script} hint="Change data-goal and data-value to describe the conversion." />
          <SnippetBox label="2. JavaScript API (fire on your own event)" code={snippets.api} hint="Use data-manual so the script does not auto-fire; call window.pus('convert', {...}) when the goal completes." />
          <SnippetBox label="3. Tracking pixel (emails / no JavaScript)" code={snippets.pixel} hint="Loads a 1x1 GIF. Works in HTML emails and static pages." />
          <SnippetBox label="4. Server-side (cURL / any backend)" code={snippets.curl} hint="POST JSON {alias, goal, value, clickId?} to /api/conv. Pass clickId for exact attribution when you have it." />
        </div>
      </Card>
    </>
  );
}
