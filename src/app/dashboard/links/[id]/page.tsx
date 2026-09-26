import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Pencil, Download, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { getStats, recentClicks } from "@/lib/stats";
import { shortUrl, parseLinkJson } from "@/lib/links";
import { countryName } from "@/lib/geo";
import { formatDate, formatNumber, truncate, cn } from "@/lib/utils";
import { PageHeader, Stat, Card, CopyButton, Badge, Alert } from "@/components/ui";
import { ClicksChart, BarsChart, DonutChart, TopList } from "@/components/ui/charts";
import { ShareButtons } from "@/components/redirect/share-buttons";
import { WorldDots } from "@/components/links/world-dots";
import { AiInsightsButton } from "@/components/links/ai-insights";
import { STATS_PERIODS } from "@/components/links/constants";

export const metadata = { title: "Link statistics" };

export default async function LinkStatsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const days = STATS_PERIODS.includes(parseInt(sp.days ?? "", 10)) ? parseInt(sp.days!, 10) : 30;
  const link = await db.link.findFirst({ where: { id, userId: ws.ownerId }, include: { domain: true, channel: true, campaign: true } });
  if (!link) notFound();
  if (!can(ws, "links", "stats")) return <Alert type="error">You do not have permission to view statistics in this team.</Alert>;
  const [s, { user, features }, st, recent] = await Promise.all([getSettings(), getUserPlan(ws.ownerId), getStats({ linkId: id }, days), recentClicks({ linkId: id }, 25)]);
  const isAdmin = user.role === "admin";
  const short = shortUrl(link);
  const qr = await QRCode.toDataURL(short, { margin: 1, width: 160 }).catch(() => "");
  const p = parseLinkJson(link);
  const variants = [{ url: link.url, label: "A" }, ...p.abUrls.map((v, i) => ({ url: v.url, label: String.fromCharCode(66 + i) }))];
  const targets = st.targets.map((t) => ({ label: `${variants.find((v) => t.label.startsWith(v.url))?.label ?? "-"} · ${truncate(t.label, 50)}`, count: t.count }));
  const countries = st.countries.map((c) => ({ label: c.label === "Unknown" ? c.label : countryName(c.label), count: c.count }));
  const aiEnabled = s["ai.enabled"] === "1" && (s["ai.features"] || "").includes("insights") && (isAdmin || features.aiCopilot);

  return (
    <>
      <PageHeader title={link.title || link.alias} description={<span className="flex flex-wrap items-center gap-2"><a href={short} target="_blank" rel="noreferrer" className="text-primary font-medium">{short}</a><CopyButton text={short} /><span className="text-muted">→</span><a href={link.url} target="_blank" rel="noreferrer" className="text-muted truncate max-w-md" title={link.url}>{truncate(link.url, 60)}</a></span>}
        actions={<>
          <ShareButtons url={short} title={link.title} />
          {(isAdmin || features.export) && <a href={`/api/links/${id}/export?days=${days}`} className="btn-secondary btn-sm"><Download size={14} /> Export clicks</a>}
          <Link href={`/dashboard/links/${id}/conversions`} className="btn-secondary btn-sm">Conversions</Link>
          <Link href={`/dashboard/live?linkId=${id}`} className="btn-secondary btn-sm">Live</Link>
          {can(ws, "links", "edit") && <Link href={`/dashboard/links/${id}/edit`} className="btn-primary btn-sm"><Pencil size={14} /> Edit</Link>}
        </>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 card p-1">{STATS_PERIODS.map((d) => <Link key={d} href={`/dashboard/links/${id}?days=${d}`} className={cn("btn-sm rounded-md px-3 py-1.5 text-xs font-medium", d === days ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>{d === 365 ? "1 year" : `${d} days`}</Link>)}</div>
        <div className="flex flex-wrap gap-1 text-xs">
          <Badge color={link.status === "active" ? "green" : link.status === "pending" ? "yellow" : "red"}>{link.status}</Badge>
          {link.redirectType !== "direct" && <Badge color="blue">{link.redirectType}</Badge>}
          {link.channel && <span className="badge" style={{ background: link.channel.color + "22", color: link.channel.color }}>{link.channel.name}</span>}
          {link.campaign && <Badge color="gray">{link.campaign.name}</Badge>}
          {link.isPublic && <a href={`/stats/${link.alias}`} target="_blank" rel="noreferrer" className="badge-gray"><Globe size={10} className="mr-1" /> public stats</a>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label={`Clicks (${days}d)`} value={formatNumber(st.total)} sub={`${formatNumber(Math.round(st.total / days * 10) / 10)} per day`} />
        <Stat label={`Unique (${days}d)`} value={formatNumber(st.unique)} sub={st.total ? `${Math.round((st.unique / st.total) * 100)}% of clicks` : undefined} />
        <Stat label="All-time clicks" value={formatNumber(link.clicks)} sub={`${formatNumber(link.uniqueClicks)} unique`} />
        <Stat label="Created" value={formatDate(link.createdAt)} sub={link.expiresAt ? `Expires ${formatDate(link.expiresAt)}` : link.clickLimit ? `Limit ${link.clickLimit} clicks` : "No expiration"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Clicks over time" className="lg:col-span-2"><ClicksChart data={st.byDay} /></Card>
        <Card title="Clicks by hour"><BarsChart data={st.byHour.map((h) => ({ label: `${h.hour}h`, count: h.clicks }))} dataKey="count" height={260} /></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        <Card title="Countries"><TopList data={countries} total={st.total} /></Card>
        <Card title="Cities"><TopList data={st.cities} total={st.total} /></Card>
        <Card title="Regions"><TopList data={st.regions} total={st.total} /></Card>
        <Card title="Referrers"><TopList data={st.referers.map((r) => ({ ...r, label: r.label === "Unknown" ? "Direct / unknown" : r.label }))} total={st.total} /></Card>
        <Card title="Browsers"><TopList data={st.browsers} total={st.total} /></Card>
        <Card title="Operating systems"><TopList data={st.os} total={st.total} /></Card>
        <Card title="Devices">{st.devices.length ? <><DonutChart data={st.devices} height={180} /><TopList data={st.devices} total={st.total} /></> : <p className="text-sm text-muted">No data yet.</p>}</Card>
        <Card title="Languages"><TopList data={st.languages} total={st.total} /></Card>
        <Card title="UTM sources"><TopList data={[...st.utmSources.filter((u) => u.label !== "Unknown"), ...st.utmMediums.filter((u) => u.label !== "Unknown").map((u) => ({ ...u, label: `medium: ${u.label}` })), ...st.utmCampaigns.filter((u) => u.label !== "Unknown").map((u) => ({ ...u, label: `campaign: ${u.label}` }))]} total={st.total} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Click map" description="Approximate visitor locations" className="lg:col-span-2"><WorldDots points={st.heatmap} /></Card>
        <Card title={p.abUrls.length ? "A/B test results" : "Destinations"} description={p.abUrls.length ? `Mode: ${link.rotatorMode}` : undefined}>
          <TopList data={targets} total={st.total} />
          {p.abUrls.length > 0 && <ul className="mt-3 text-xs text-muted space-y-1">{variants.map((v) => <li key={v.label}><b className="text-fg">{v.label}</b> {truncate(v.url, 60)}</li>)}</ul>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Recent clicks" className="lg:col-span-2">
          {recent.length === 0 ? <p className="text-sm text-muted">No clicks yet.</p> : (
            <div className="overflow-x-auto -m-5"><table className="table">
              <thead><tr><th>Time</th><th>Location</th><th>Referrer</th><th>Device</th><th>Target</th></tr></thead>
              <tbody>{recent.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap text-xs">{formatDate(c.createdAt, true)}{c.isUnique && <span className="badge-green ml-1">new</span>}</td>
                  <td className="text-xs">{[c.city, c.region, c.countryCode ? countryName(c.countryCode) : null].filter(Boolean).join(", ") || "Unknown"}</td>
                  <td className="text-xs text-muted">{c.refererHost || "Direct"}</td>
                  <td className="text-xs text-muted">{[c.device, c.os, c.browser].filter(Boolean).join(" · ")}</td>
                  <td className="text-xs text-muted max-w-[12rem] truncate" title={c.targetUrl ?? ""}>{c.targetUrl ? truncate(c.targetUrl, 40) : "-"}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="QR code" actions={<Link href={`/dashboard/qr/new?linkId=${id}`} className="btn-secondary btn-sm">Customize</Link>}>
            <div className="flex items-center gap-4">{qr && <img src={qr} alt="QR code" className="h-32 w-32 rounded-lg border border-border bg-white" />}<div className="text-xs text-muted space-y-2"><p>Scan to open {short.replace(/^https?:\/\//, "")}.</p>{qr && <a href={qr} download={`qr-${link.alias}.png`} className="btn-secondary btn-sm"><Download size={12} /> Download PNG</a>}</div></div>
          </Card>
          {aiEnabled && <Card title="AI Copilot" description="Insights from this period's data"><AiInsightsButton linkId={id} days={days} /></Card>}
          {link.notes && <Card title="Notes"><p className="text-sm whitespace-pre-line">{link.notes}</p></Card>}
        </div>
      </div>
    </>
  );
}
