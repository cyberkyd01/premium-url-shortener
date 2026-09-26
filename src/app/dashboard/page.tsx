import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan, withinLimit, type LimitKey } from "@/lib/plan";
import { getStats, recentClicks } from "@/lib/stats";
import { shortUrl } from "@/lib/links";
import { countryName } from "@/lib/geo";
import { appHost, formatNumber, formatDate, startOfDay, truncate } from "@/lib/utils";
import { Stat, Card, Empty } from "@/components/ui";
import { ClicksChart } from "@/components/ui/charts";
import { QuickShortenForm } from "@/components/links/quick-shorten-form";

export const metadata = { title: "Overview" };

function UsageBar({ label, used, limit, href }: { label: string; used: number; limit: number; href: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <Link href={href} className="block">
      <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted">{formatNumber(used)}{unlimited ? "" : ` / ${limit}`}</span></div>
      <div className="h-2 rounded bg-border mt-1"><div className={"h-2 rounded " + (pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warning" : "bg-primary")} style={{ width: unlimited ? "8%" : `${pct}%` }} /></div>
    </Link>
  );
}

export default async function DashboardOverview() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [s, { plan }] = await Promise.all([getSettings(), getUserPlan(ws.ownerId)]);
  const owner = ws.ownerId;
  const [linksCount, clicksToday, bioCount, qrCount, stats, topLinks, recent, domains, usage] = await Promise.all([
    db.link.count({ where: { userId: owner } }),
    db.click.count({ where: { link: { userId: owner }, isBot: false, createdAt: { gte: startOfDay() } } }),
    db.bioPage.count({ where: { userId: owner } }),
    db.qrCode.count({ where: { userId: owner } }),
    getStats({ userId: owner }, 30),
    db.link.findMany({ where: { userId: owner, isArchived: false }, orderBy: { clicks: "desc" }, take: 5, include: { domain: true } }),
    recentClicks({ userId: owner }, 10),
    db.domain.findMany({ where: { status: 1, isMain: false, OR: [{ userId: owner }, { isPublic: true }] }, select: { id: true, domain: true } }),
    Promise.all((["limitLinks", "limitBioPages", "limitQrCodes", "limitDomains"] as LimitKey[]).map(async (k) => ({ key: k, ...(await withinLimit(owner, k)) }))),
  ]);
  const counts: Record<LimitKey, number> = { limitLinks: linksCount, limitBioPages: bioCount, limitQrCodes: qrCount, limitDomains: await db.domain.count({ where: { userId: owner } }) } as Record<LimitKey, number>;
  const labels: Partial<Record<LimitKey, [string, string]>> = { limitLinks: ["Links", "/dashboard/links"], limitBioPages: ["Bio pages", "/dashboard/bio"], limitQrCodes: ["QR codes", "/dashboard/qr"], limitDomains: ["Custom domains", "/dashboard/domains"] };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-muted text-sm mt-1">{ws.isTeam ? `Team workspace: ${ws.teamName}` : "Your workspace at a glance."}</p></div>
        <Link href="/dashboard/links/new" className="btn-primary btn-sm">Shorten link</Link>
      </div>

      <Card className="mb-6" title="Quick shorten"><QuickShortenForm domains={domains} appHost={appHost()} mainUsable={s["domains.mainUsable"] === "1" || ws.isAdmin} /></Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="Links" value={formatNumber(linksCount)} sub={<Link href="/dashboard/links" className="text-primary">Manage links</Link>} />
        <Stat label="Clicks today" value={formatNumber(clicksToday)} sub={`${formatNumber(stats.total)} in the last 30 days`} />
        <Stat label="Bio pages" value={formatNumber(bioCount)} sub={<Link href="/dashboard/bio" className="text-primary">Manage bio pages</Link>} />
        <Stat label="QR codes" value={formatNumber(qrCount)} sub={<Link href="/dashboard/qr" className="text-primary">Manage QR codes</Link>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card title="Clicks — last 30 days" description={`${formatNumber(stats.unique)} unique visitors`} className="lg:col-span-2"><ClicksChart data={stats.byDay} /></Card>
        <Card title="Plan usage" description={`${plan?.name ?? "Free"} plan`} actions={s["payments.enabled"] === "1" ? <Link href="/dashboard/billing" className="btn-secondary btn-sm">Upgrade</Link> : undefined}>
          <div className="space-y-4">{usage.map((u) => { const l = labels[u.key]; return l ? <UsageBar key={u.key} label={l[0]} used={u.limit === -1 ? counts[u.key] : u.used} limit={u.limit} href={l[1]} /> : null; })}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card title="Top links" actions={<Link href="/dashboard/links?sort=clicks" className="text-sm text-primary inline-flex items-center gap-1">All <ArrowRight size={14} /></Link>}>
          {topLinks.length === 0 ? <Empty title="No links yet" description="Shorten your first link above." /> : (
            <ul className="divide-y divide-border -my-2">{topLinks.map((l) => (
              <li key={l.id} className="py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1"><Link href={`/dashboard/links/${l.id}`} className="font-medium text-primary truncate block">{shortUrl(l).replace(/^https?:\/\//, "")}</Link><p className="text-xs text-muted truncate">{l.title || truncate(l.url, 60)}</p></div>
                <span className="text-sm font-semibold whitespace-nowrap">{formatNumber(l.clicks)} clicks</span>
              </li>))}</ul>
          )}
        </Card>
        <Card title="Recent clicks">
          {recent.length === 0 ? <Empty title="No clicks yet" description="Share your links to start collecting statistics." /> : (
            <ul className="divide-y divide-border -my-2 text-sm">{recent.map((c) => (
              <li key={c.id} className="py-2 flex items-center gap-3">
                <div className="min-w-0 flex-1"><p className="truncate"><span className="font-medium">{c.link?.alias ?? "-"}</span> <span className="text-muted">from {[c.city, c.countryCode ? countryName(c.countryCode) : null].filter(Boolean).join(", ") || "Unknown"}</span></p><p className="text-xs text-muted">{[c.device, c.browser, c.refererHost || "direct"].filter(Boolean).join(" · ")}</p></div>
                <span className="text-xs text-muted whitespace-nowrap">{formatDate(c.createdAt, true)}</span>
              </li>))}</ul>
          )}
        </Card>
      </div>

      {s["ai.enabled"] === "1" && (
        <div className="card p-5 flex flex-wrap items-center gap-4 bg-gradient-to-r from-primary/10 to-accent/10">
          <span className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center"><Sparkles size={18} /></span>
          <div className="flex-1 min-w-48"><p className="font-semibold">AI Copilot</p><p className="text-sm text-muted">Get slug suggestions, bio page copy and plain-language insights about your click data.</p></div>
          <Link href="/dashboard/ai" className="btn-primary btn-sm">Open AI Copilot</Link>
        </div>
      )}
    </>
  );
}
