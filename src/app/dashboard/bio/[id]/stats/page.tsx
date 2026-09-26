import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getStats } from "@/lib/stats";
import { formatDate, formatNumber, json } from "@/lib/utils";
import { countryName } from "@/lib/geo";
import { widgetDef } from "@/lib/bio-widgets";
import { Card, PageHeader, Stat, Badge } from "@/components/ui";
import { ClicksChart, DonutChart, TopList, BarsChart } from "@/components/ui/charts";

export const metadata = { title: "Bio page stats" };

export default async function BioStatsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string; type?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const page = await db.bioPage.findFirst({ where: { id, userId: ws.ownerId }, include: { blocks: { orderBy: { clicks: "desc" } } } });
  if (!page) notFound();
  const days = [7, 30, 90].includes(parseInt(sp.days ?? "30", 10)) ? parseInt(sp.days ?? "30", 10) : 30;
  const type = ["contact", "newsletter", "poll"].includes(sp.type ?? "") ? sp.type : "";
  const [stats, submissions, counts] = await Promise.all([
    getStats({ bioPageId: page.id }, days),
    db.bioSubmission.findMany({ where: { bioPageId: page.id, ...(type ? { type } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.bioSubmission.groupBy({ by: ["type"], where: { bioPageId: page.id }, _count: { _all: true } }),
  ]);
  const totalBlockClicks = page.blocks.reduce((a, b) => a + b.clicks, 0);
  const countries = stats.countries.map((c) => ({ label: c.label === "Unknown" ? c.label : countryName(c.label), count: c.count }));
  const blockLabel = (id: string | null) => { const b = page.blocks.find((x) => x.id === id); return b ? (b.title || widgetDef(b.type)?.label || b.type) : "—"; };

  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2"><Link href="/dashboard/bio" className="btn-ghost btn-sm"><ArrowLeft size={16} /></Link>{page.name || page.alias}</span>} description={`Statistics for /${page.alias}`}
        actions={<><div className="flex gap-1">{[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={"btn-secondary btn-sm" + (d === days ? " bg-primary text-primary-fg border-primary" : "")}>{d}d</Link>)}</div><Link href={`/dashboard/bio/${page.id}`} className="btn-primary btn-sm"><Pencil size={14} />Edit</Link></>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label={`Views (${days}d)`} value={formatNumber(stats.total)} sub={`${formatNumber(page.views)} all time`} />
        <Stat label="Unique views" value={formatNumber(stats.unique)} sub={`${formatNumber(page.uniqueViews)} all time`} />
        <Stat label="Block clicks" value={formatNumber(totalBlockClicks)} sub="all time" />
        <Stat label="Submissions" value={formatNumber(counts.reduce((a, c) => a + c._count._all, 0))} sub={counts.map((c) => `${c._count._all} ${c.type}`).join(" · ") || "none yet"} />
      </div>
      <Card title="Views over time" className="mb-6"><ClicksChart data={stats.byDay} /></Card>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <Card title="Countries"><TopList data={countries} total={stats.total} /></Card>
        <Card title="Devices">{stats.devices.length ? <DonutChart data={stats.devices} /> : <p className="text-sm text-muted">No data yet.</p>}<TopList data={stats.devices} total={stats.total} /></Card>
        <Card title="Referrers"><TopList data={stats.referers} total={stats.total} /></Card>
        <Card title="Browsers"><TopList data={stats.browsers} total={stats.total} /></Card>
        <Card title="Operating systems"><TopList data={stats.os} total={stats.total} /></Card>
        <Card title="Views by hour"><BarsChart data={stats.byHour} dataKey="clicks" xKey="hour" height={180} /></Card>
      </div>
      <Card title="Clicks per block" className="mb-6">
        {page.blocks.length ? (
          <table className="table"><thead><tr><th>Block</th><th>Type</th><th>Status</th><th className="text-right">Clicks</th><th className="text-right">CTR</th></tr></thead>
            <tbody>{page.blocks.map((b) => <tr key={b.id}><td className="max-w-xs truncate">{b.title || b.url || "—"}</td><td><Badge>{widgetDef(b.type)?.label ?? b.type}</Badge></td><td>{b.enabled ? <Badge color="green">Enabled</Badge> : <Badge color="gray">Disabled</Badge>}</td><td className="text-right">{formatNumber(b.clicks)}</td><td className="text-right text-muted">{page.views ? ((b.clicks / page.views) * 100).toFixed(1) + "%" : "—"}</td></tr>)}</tbody></table>
        ) : <p className="text-sm text-muted">No blocks yet.</p>}
      </Card>
      <Card title="Submissions" description="Contact form messages, newsletter subscribers and poll votes"
        actions={<><div className="flex gap-1">{["", "contact", "newsletter", "poll"].map((t) => <Link key={t} href={`?days=${days}&type=${t}`} className={"btn-secondary btn-sm" + (t === type ? " bg-primary text-primary-fg border-primary" : "")}>{t || "All"}</Link>)}</div><a href={`/api/bio/submissions?pageId=${page.id}&type=${type}`} className="btn-secondary btn-sm"><Download size={14} />CSV</a></>}>
        {submissions.length ? (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Date</th><th>Type</th><th>Block</th><th>Data</th></tr></thead>
            <tbody>{submissions.map((s) => { const d = json<Record<string, string>>(s.data, {}); return <tr key={s.id}><td className="whitespace-nowrap">{formatDate(s.createdAt, true)}</td><td><Badge color={s.type === "contact" ? "blue" : s.type === "newsletter" ? "green" : "yellow"}>{s.type}</Badge></td><td className="max-w-40 truncate">{blockLabel(s.blockId)}</td><td className="text-xs">{Object.entries(d).map(([k, v]) => <div key={k}><span className="text-muted">{k}:</span> {v}</div>)}</td></tr>; })}</tbody></table></div>
        ) : <p className="text-sm text-muted">No submissions yet.</p>}
      </Card>
    </div>
  );
}
