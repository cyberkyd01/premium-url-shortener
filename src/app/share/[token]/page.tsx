import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Lock, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getStats } from "@/lib/stats";
import { shortUrl } from "@/lib/links";
import { countryName } from "@/lib/geo";
import { ogImageUrl } from "@/lib/og";
import { appUrl, formatDate, formatNumber, truncate } from "@/lib/utils";
import { ClicksChart, BarsChart, DonutChart, TopList } from "@/components/ui/charts";
import { Card, Stat } from "@/components/ui";
import { ShareTools, SharePasswordForm } from "@/components/premium/share-tools";
import { unlockSharedReport } from "./actions";
import { shareCookieName, shareCookieValue } from "./token";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };
const DAYS = 30;

const PRINT_CSS = `@media print { .no-print { display: none !important; } body > :not(#share-report) { display: none !important; } #share-report { padding: 0 !important; } .card { break-inside: avoid; box-shadow: none !important; } }`;

async function load(token: string) {
  return db.sharedReport.findUnique({ where: { token }, include: { link: { include: { domain: true } }, user: { select: { username: true, name: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const [s, r] = await Promise.all([getSettings(), load(token)]);
  const title = r?.title || "Analytics report";
  return { title, robots: { index: false, follow: false }, openGraph: { title, siteName: s["site.name"], images: [ogImageUrl({ title, subtitle: `Shared analytics · ${s["site.name"]}`, type: "report" })] } };
}

export default async function SharedReportPage({ params }: Props) {
  const { token } = await params;
  const [s, report] = await Promise.all([getSettings(), load(token)]);
  if (!report) notFound();
  const siteName = s["site.name"];
  const logo = s["site.logo"] || "";
  const brand = <a href={appUrl()} className="inline-flex items-center gap-2 font-bold text-lg">{logo ? <img src={logo} alt={siteName} className="h-8" /> : siteName}</a>;

  const shell = (children: React.ReactNode) => (
    <div id="share-report" className="min-h-screen px-4 py-8 md:py-12">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="max-w-6xl mx-auto">{children}</div>
    </div>
  );

  if (report.expiresAt && report.expiresAt < new Date()) {
    return shell(<div className="max-w-md mx-auto text-center py-20"><span className="h-14 w-14 rounded-full bg-warning/10 text-warning grid place-items-center mx-auto mb-4"><Clock size={24} /></span><h1 className="text-2xl font-bold">This report has expired</h1><p className="text-muted text-sm mt-2">Ask the person who shared it with you for a new link.</p><div className="mt-8">{brand}</div></div>);
  }
  if (report.password) {
    const store = await cookies();
    const ok = store.get(shareCookieName(report.id))?.value === shareCookieValue(report.id, report.password);
    if (!ok) {
      return shell(<div className="max-w-sm mx-auto py-16"><div className="text-center mb-6">{brand}</div><div className="card p-6"><span className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3"><Lock size={20} /></span><h1 className="text-xl font-bold text-center">{report.title || "Protected report"}</h1><p className="text-sm text-muted text-center mt-1 mb-5">This analytics report is password protected.</p><SharePasswordForm token={token} action={unlockSharedReport} /></div></div>);
    }
  }

  // Resolve the subject and its stats.
  let subject = { title: report.title || "Analytics report", subtitle: "", href: null as string | null };
  let filter: { linkId?: string; linkIds?: string[]; bioPageId?: string } = {};
  let allTime = 0;
  if (report.linkId && report.link) {
    const l = report.link;
    filter = { linkId: l.id };
    allTime = l.clicks;
    subject = { title: report.title || l.title || `/${l.alias}`, subtitle: `${shortUrl(l)} → ${truncate(l.url, 80)}`, href: shortUrl(l) };
  } else if (report.campaignId) {
    const c = await db.campaign.findUnique({ where: { id: report.campaignId }, include: { links: { select: { id: true, clicks: true } } } });
    if (!c) notFound();
    filter = { linkIds: c.links.map((l) => l.id) };
    allTime = c.links.reduce((n, l) => n + l.clicks, 0);
    subject = { title: report.title || c.name, subtitle: `Campaign · ${c.links.length} link${c.links.length === 1 ? "" : "s"}`, href: null };
  } else if (report.bioPageId) {
    const b = await db.bioPage.findUnique({ where: { id: report.bioPageId } });
    if (!b) notFound();
    filter = { bioPageId: b.id };
    allTime = b.views;
    subject = { title: report.title || b.name || `/${b.alias}`, subtitle: `Bio page · ${appUrl("/" + b.alias)}`, href: appUrl("/" + b.alias) };
  } else notFound();
  if (filter.linkIds && filter.linkIds.length === 0) filter = { linkIds: ["__none__"] };

  const [st] = await Promise.all([getStats(filter, DAYS), db.sharedReport.update({ where: { id: report.id }, data: { views: { increment: 1 } } })]);
  const countries = st.countries.map((c) => ({ label: c.label === "Unknown" ? c.label : countryName(c.label), count: c.count }));
  const label = report.bioPageId ? "views" : "clicks";

  return shell(<>
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div className="mb-3">{brand}</div>
        <p className="text-xs uppercase tracking-wide text-muted">Shared analytics · last {DAYS} days</p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">{subject.title}</h1>
        {subject.subtitle && <p className="text-sm text-muted mt-1 break-all">{subject.href ? <a href={subject.href} target="_blank" rel="noreferrer" className="text-primary">{subject.subtitle}</a> : subject.subtitle}</p>}
        <p className="text-xs text-muted mt-1">Generated {formatDate(new Date(), true)} · shared by {report.user.name || report.user.username}</p>
      </div>
      <ShareTools byDay={st.byDay} filename={`report-${subject.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`} />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <Stat label={`Total ${label}`} value={formatNumber(allTime)} sub="All time" />
      <Stat label={`${label[0].toUpperCase() + label.slice(1)} (${DAYS}d)`} value={formatNumber(st.total)} sub={`${formatNumber(Math.round((st.total / DAYS) * 10) / 10)} per day`} />
      <Stat label={`Unique (${DAYS}d)`} value={formatNumber(st.unique)} sub={st.total ? `${Math.round((st.unique / st.total) * 100)}% of ${label}` : undefined} />
      <Stat label="Top country" value={countries[0]?.label ?? "-"} sub={countries[0] ? `${formatNumber(countries[0].count)} ${label}` : "No data yet"} />
    </div>

    <div className="grid gap-4 lg:grid-cols-3 mb-4">
      <Card title={`${label[0].toUpperCase() + label.slice(1)} over time`} className="lg:col-span-2"><ClicksChart data={st.byDay} /></Card>
      <Card title="By hour of day"><BarsChart data={st.byHour.map((h) => ({ label: `${h.hour}h`, count: h.clicks }))} height={260} /></Card>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
      <Card title="Countries"><TopList data={countries} total={st.total} /></Card>
      <Card title="Referrers"><TopList data={st.referers.map((r) => ({ ...r, label: r.label === "Unknown" ? "Direct / unknown" : r.label }))} total={st.total} /></Card>
      <Card title="Devices">{st.devices.length ? <><DonutChart data={st.devices} height={160} /><TopList data={st.devices} total={st.total} /></> : <p className="text-sm text-muted">No data yet.</p>}</Card>
      <Card title="Browsers"><TopList data={st.browsers} total={st.total} /></Card>
      <Card title="Operating systems"><TopList data={st.os} total={st.total} /></Card>
      <Card title="Cities"><TopList data={st.cities} total={st.total} /></Card>
    </div>

    <Card title={`Daily ${label}`} description="The same data as the CSV download" className="mb-6">
      <div className="overflow-x-auto -m-5"><table className="table"><thead><tr><th>Date</th><th className="text-right">{label[0].toUpperCase() + label.slice(1)}</th></tr></thead><tbody>{st.byDay.filter((d) => d.clicks > 0).map((d) => <tr key={d.date}><td className="text-xs">{d.date}</td><td className="text-xs text-right tabular-nums">{formatNumber(d.clicks)}</td></tr>)}{st.byDay.every((d) => !d.clicks) && <tr><td colSpan={2} className="text-sm text-muted">No {label} in this period.</td></tr>}</tbody></table></div>
    </Card>

    <p className="text-center text-xs text-muted">Report powered by <a href={appUrl()} className="text-primary">{siteName}</a>. Bot traffic is excluded.</p>
  </>);
}
