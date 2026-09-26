import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { getStats } from "@/lib/stats";
import { shortUrl } from "@/lib/links";
import { planFeatures } from "@/lib/plan";
import { appHost, formatDate, formatNumber, truncate } from "@/lib/utils";
import { ClicksChart, BarsChart, DonutChart, TopList } from "@/components/ui/charts";
import { Card, Stat } from "@/components/ui";
import { Lock } from "lucide-react";

type Props = { params: Promise<{ alias: string }> };

async function findLink(alias: string) {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0].toLowerCase();
  const isMain = !host || host === appHost().split(":")[0].toLowerCase();
  if (!isMain) {
    const byDomain = await db.link.findFirst({ where: { alias, domain: { domain: host } }, include: { domain: true, user: { include: { plan: true } } } });
    if (byDomain) return byDomain;
  }
  return db.link.findFirst({ where: { alias, domainId: null }, include: { domain: true, user: { include: { plan: true } } } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { alias } = await params;
  return { title: `Stats for /${alias}`, robots: { index: false } };
}

export default async function PublicStatsPage({ params }: Props) {
  const { alias } = await params;
  const [s, link, viewer] = await Promise.all([getSettings(), findLink(alias), currentUser()]);
  if (!link) notFound();
  const isOwner = !!viewer && (viewer.id === link.userId || viewer.role === "admin");
  const planAllows = !link.user || link.user.role === "admin" || planFeatures(link.user.plan).publicStats;
  const visible = isOwner || (s["links.publicStats"] === "1" && link.isPublic && planAllows && link.status === "active");
  const short = shortUrl(link);
  if (!visible) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <span className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-4"><Lock size={24} /></span>
        <h1 className="text-2xl font-bold">These stats are private</h1>
        <p className="text-muted mt-2 text-sm">The owner of <span className="font-medium text-fg">{short}</span> has not made its statistics public.</p>
        {!viewer && <Link href={`/login?callbackUrl=/stats/${encodeURIComponent(alias)}`} className="btn-primary mt-6">Login</Link>}
      </div>
    );
  }
  const stats = await getStats({ linkId: link.id }, 30);
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Public statistics · last 30 days</p>
          <h1 className="text-2xl font-bold mt-1"><a href={short} target="_blank" rel="noreferrer" className="text-primary">{short}</a></h1>
          <p className="text-sm text-muted mt-1 truncate max-w-xl">{link.title ? `${link.title} · ` : ""}{truncate(link.url, 90)}</p>
          <p className="text-xs text-muted mt-1">Created {formatDate(link.createdAt)}</p>
        </div>
        {isOwner && <Link href={`/dashboard/links/${link.id}`} className="btn-secondary btn-sm">Manage link</Link>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat label="Total clicks" value={formatNumber(link.clicks)} sub="All time" />
        <Stat label="Clicks (30 days)" value={formatNumber(stats.total)} />
        <Stat label="Unique visitors (30 days)" value={formatNumber(stats.unique)} />
      </div>
      <Card title="Clicks over time" className="mb-6"><ClicksChart data={stats.byDay} /></Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Countries"><TopList data={stats.countries} total={stats.total} /></Card>
        <Card title="Referrers"><TopList data={stats.referers} total={stats.total} /></Card>
        <Card title="Devices">{stats.devices.length ? <DonutChart data={stats.devices} /> : <p className="text-sm text-muted">No data yet.</p>}</Card>
        <Card title="Browsers">{stats.browsers.length ? <BarsChart data={stats.browsers} /> : <p className="text-sm text-muted">No data yet.</p>}</Card>
        <Card title="Operating systems"><TopList data={stats.os} total={stats.total} /></Card>
        <Card title="Clicks by hour"><BarsChart data={stats.byHour} dataKey="clicks" xKey="hour" /></Card>
      </div>
      {s["ads.enabled"] === "1" && s["ads.sidebar"] && <div className="mt-8 text-center" dangerouslySetInnerHTML={{ __html: s["ads.sidebar"] }} />}
      <p className="text-center text-xs text-muted mt-10">Want stats like these for your own links? <Link href="/register" className="text-primary">Create a free account</Link>.</p>
    </div>
  );
}
