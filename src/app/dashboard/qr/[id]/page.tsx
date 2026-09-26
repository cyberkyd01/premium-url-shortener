import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getStats, recentClicks } from "@/lib/stats";
import { appUrl, formatDate, formatNumber, json } from "@/lib/utils";
import { countryName } from "@/lib/geo";
import { shortUrl } from "@/lib/links";
import { bioUrl } from "@/lib/bio-widgets";
import { qrPayload, qrTarget, encodeQrStyle, normalizeQrStyle, QR_TYPES } from "@/lib/qr";
import { Card, PageHeader, Stat, Badge, CopyButton } from "@/components/ui";
import { ClicksChart, DonutChart, TopList } from "@/components/ui/charts";

export const metadata = { title: "QR code stats" };

export default async function QrStatsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const qr = await db.qrCode.findFirst({ where: { id, userId: ws.ownerId }, include: { channel: true, link: { include: { domain: true } }, bioPage: { include: { domain: true } } } });
  if (!qr) notFound();
  const days = [7, 30, 90].includes(parseInt(sp.days ?? "30", 10)) ? parseInt(sp.days ?? "30", 10) : 30;
  const base = appUrl("/");
  const extra = { shortUrl: qr.link ? shortUrl(qr.link) : null, bioUrl: qr.bioPage ? bioUrl(qr.bioPage, base) : null };
  const payload = qrPayload(qr, extra);
  const target = qrTarget(qr, extra);
  const style = normalizeQrStyle(json(qr.style, {})); style.size = 240;
  const [stats, recent] = await Promise.all([getStats({ qrCodeId: qr.id }, days), recentClicks({ qrCodeId: qr.id }, 30)]);
  const countries = stats.countries.map((c) => ({ label: c.label === "Unknown" ? c.label : countryName(c.label), count: c.count }));
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2"><Link href="/dashboard/qr" className="btn-ghost btn-sm"><ArrowLeft size={16} /></Link>{qr.name}</span>} description={<span className="flex items-center gap-2 flex-wrap"><Badge>{QR_TYPES.find((t) => t.type === qr.type)?.label ?? qr.type}</Badge>{qr.isDynamic ? <Badge color="blue">Dynamic</Badge> : <Badge color="gray">Static</Badge>}{qr.channel && <Badge color="gray">{qr.channel.name}</Badge>}<span>Created {formatDate(qr.createdAt)}</span></span>}
        actions={<><div className="flex gap-1">{[7, 30, 90].map((d) => <Link key={d} href={`?days=${d}`} className={"btn-secondary btn-sm" + (d === days ? " bg-primary text-primary-fg border-primary" : "")}>{d}d</Link>)}</div>{can(ws, "qr", "edit") && <Link href={`/dashboard/qr/${qr.id}/edit`} className="btn-primary btn-sm"><Pencil size={14} />Edit</Link>}</>} />
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 mb-6">
        <div className="card p-5 flex flex-col items-center gap-3">
          <img src={`/api/qr/render?data=${encodeURIComponent(payload)}&style=${encodeQrStyle(style)}`} alt={qr.name} className="w-56 h-auto rounded-lg bg-white" />
          <div className="flex gap-1.5 w-full"><a href={`/api/qr/${qr.id}/download?format=png`} className="btn-secondary btn-sm flex-1"><Download size={14} />PNG</a><a href={`/api/qr/${qr.id}/download?format=svg`} className="btn-secondary btn-sm flex-1"><Download size={14} />SVG</a><a href={`/api/qr/${qr.id}/download?format=pdf`} className="btn-secondary btn-sm flex-1"><Download size={14} />PDF</a></div>
          <div className="w-full text-xs space-y-1">
            <p className="text-muted">Encodes</p><p className="break-all flex items-center gap-1"><span className="flex-1">{payload}</span><CopyButton text={payload} label="" /></p>
            {qr.isDynamic && <><p className="text-muted mt-2">Redirects to</p><p className="break-all">{target}</p></>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 content-start">
          <Stat label={`Scans (${days}d)`} value={formatNumber(stats.total)} sub={`${formatNumber(qr.scans)} all time`} />
          <Stat label="Unique scans" value={formatNumber(stats.unique)} />
          <div className="col-span-2 card p-5"><p className="text-sm text-muted mb-2">Scans over time</p>{qr.isDynamic ? <ClicksChart data={stats.byDay} /> : <p className="text-sm text-muted">Static QR codes cannot be tracked. Recreate it as a dynamic code to see scan analytics.</p>}</div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <Card title="Countries"><TopList data={countries} total={stats.total} /></Card>
        <Card title="Devices">{stats.devices.length ? <DonutChart data={stats.devices} /> : null}<TopList data={stats.devices} total={stats.total} /></Card>
        <Card title="Cities"><TopList data={stats.cities} total={stats.total} /></Card>
        <Card title="Operating systems"><TopList data={stats.os} total={stats.total} /></Card>
        <Card title="Browsers"><TopList data={stats.browsers} total={stats.total} /></Card>
        <Card title="Referrers"><TopList data={stats.referers} total={stats.total} /></Card>
      </div>
      <Card title="Recent scans">
        {recent.length ? (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Date</th><th>Location</th><th>Device</th><th>OS / Browser</th><th>Referrer</th></tr></thead>
            <tbody>{recent.map((c) => <tr key={c.id}><td className="whitespace-nowrap">{formatDate(c.createdAt, true)}</td><td>{[c.city, c.countryCode ? countryName(c.countryCode) : null].filter(Boolean).join(", ") || "Unknown"}</td><td className="capitalize">{c.device}</td><td>{[c.os, c.browser].filter(Boolean).join(" / ") || "—"}</td><td className="text-muted">{c.refererHost || "Direct"}</td></tr>)}</tbody></table></div>
        ) : <p className="text-sm text-muted">No scans recorded yet.</p>}
      </Card>
    </div>
  );
}
