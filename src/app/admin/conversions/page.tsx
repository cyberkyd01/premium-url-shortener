import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { getSetting } from "@/lib/settings";
import { daysAgo, formatDate, formatMoney, formatNumber } from "@/lib/utils";
import { Card, PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { BarsChart, DonutChart } from "@/components/ui/charts";
import { FilterBar } from "@/components/admin/filter-bar";
import { Table } from "@/components/admin/table";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminConversionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const goal = qs(sp, "goal"), q = qs(sp, "q"), user = qs(sp, "user");
  const { page, perPage, skip, take } = paging(sp);
  const currency = await getSetting("payments.currency");
  const d30 = daysAgo(30);
  const where: Prisma.ConversionWhereInput = {
    ...(goal ? { goal } : {}),
    ...(q ? { link: { OR: [{ alias: { contains: q } }, { url: { contains: q } }, { title: { contains: q } }] } } : {}),
    ...(user ? { link: { user: { OR: [{ username: { contains: user } }, { email: { contains: user } }] } } } : {}),
  };
  const [totals, totals30, byGoal, topLinks, recent, total, last30, linksWithGoals] = await Promise.all([
    db.conversion.aggregate({ _count: { _all: true }, _sum: { value: true } }),
    db.conversion.aggregate({ _count: { _all: true }, _sum: { value: true }, where: { createdAt: { gte: d30 } } }),
    db.conversion.groupBy({ by: ["goal"], _count: { _all: true }, _sum: { value: true } }),
    db.link.findMany({ where: { conversions: { gt: 0 } }, orderBy: [{ conversions: "desc" }, { conversionValue: "desc" }], take: 10, select: { id: true, alias: true, url: true, clicks: true, conversions: true, conversionValue: true, user: { select: { id: true, username: true } }, domain: { select: { domain: true } } } }),
    db.conversion.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { link: { select: { id: true, alias: true, url: true, user: { select: { id: true, username: true } } } } } }),
    db.conversion.count({ where }),
    db.conversion.findMany({ where: { createdAt: { gte: d30 } }, select: { createdAt: true, value: true } }),
    db.link.count({ where: { conversions: { gt: 0 } } }),
  ]);
  const goals = [...byGoal].sort((a, b) => b._count._all - a._count._all);
  const days: string[] = []; for (let i = 29; i >= 0; i--) days.push(daysAgo(i).toISOString().slice(0, 10));
  const byDay = days.map((date) => {
    const rows = last30.filter((c) => c.createdAt.toISOString().slice(0, 10) === date);
    return { date: date.slice(5), count: rows.length, value: Math.round(rows.reduce((s, c) => s + c.value, 0) * 100) / 100 };
  });
  const totalCount = totals._count._all, totalValue = totals._sum.value ?? 0;

  return (
    <div>
      <PageHeader title="Conversions" description="Goal completions tracked through the conversion pixel / API across every account" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Conversions (all time)" value={formatNumber(totalCount)} sub={`${formatNumber(totals30._count._all)} in the last 30 days`} />
        <Stat label="Conversion value" value={formatMoney(totalValue, currency)} sub={`${formatMoney(totals30._sum.value ?? 0, currency)} in the last 30 days`} />
        <Stat label="Average value" value={formatMoney(totalCount ? totalValue / totalCount : 0, currency)} sub="per conversion" />
        <Stat label="Converting links" value={formatNumber(linksWithGoals)} sub={`${goals.length} distinct goal${goals.length === 1 ? "" : "s"}`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Conversions per day (30 days)" className="lg:col-span-2"><BarsChart data={byDay} xKey="date" dataKey="count" height={240} /></Card>
        <Card title="By goal">{goals.length ? <DonutChart data={goals.map((g) => ({ label: g.goal, count: g._count._all }))} height={240} /> : <p className="text-sm text-muted py-8 text-center">No conversions yet.</p>}</Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card title="Top links by conversions">
          {topLinks.length === 0 ? <p className="text-sm text-muted">No link has recorded a conversion yet.</p> : (
            <table className="table">
              <thead><tr><th>Link</th><th>Owner</th><th>Clicks</th><th>Conv.</th><th>Rate</th><th>Value</th></tr></thead>
              <tbody>
                {topLinks.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/admin/links/${l.id}`} className="font-medium">{l.domain?.domain ?? ""}/{l.alias}</Link><span className="block text-xs text-muted truncate max-w-[220px]">{l.url}</span></td>
                    <td>{l.user ? <Link href={`/admin/users/${l.user.id}`}>{l.user.username}</Link> : <span className="text-muted">anonymous</span>}</td>
                    <td>{formatNumber(l.clicks)}</td>
                    <td className="font-semibold">{formatNumber(l.conversions)}</td>
                    <td className="text-muted">{l.clicks ? `${Math.min(100, Math.round((l.conversions / l.clicks) * 1000) / 10)}%` : "-"}</td>
                    <td>{formatMoney(l.conversionValue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Goals">
          {goals.length === 0 ? <p className="text-sm text-muted">No goals recorded yet.</p> : (
            <table className="table">
              <thead><tr><th>Goal</th><th>Conversions</th><th>Value</th><th>Share</th></tr></thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.goal}>
                    <td><Link href={`/admin/conversions?goal=${encodeURIComponent(g.goal)}`} className="font-mono text-sm">{g.goal}</Link></td>
                    <td>{formatNumber(g._count._all)}</td>
                    <td>{formatMoney(g._sum.value ?? 0, currency)}</td>
                    <td className="text-muted">{totalCount ? Math.round((g._count._all / totalCount) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <h2 className="text-lg font-semibold mb-3">Recent conversions</h2>
      <FilterBar fields={[
        { name: "goal", type: "select", value: goal, options: [{ value: "", label: "All goals" }, ...goals.map((g) => ({ value: g.goal, label: g.goal }))] },
        { name: "q", value: q, placeholder: "Link alias, URL or title" },
        { name: "user", value: user, placeholder: "Owner username or email" },
      ]} />
      <Table count={recent.length} empty="No conversions match these filters." head={["Time", "Link", "Owner", "Goal", "Value", "Country", "Device", "Attributed click"]}>
        {recent.map((c) => (
          <tr key={c.id}>
            <td className="text-muted text-xs whitespace-nowrap">{formatDate(c.createdAt, true)}</td>
            <td><Link href={`/admin/links/${c.link.id}`} className="font-medium">/{c.link.alias}</Link><span className="block text-xs text-muted truncate max-w-[220px]">{c.link.url}</span></td>
            <td>{c.link.user ? <Link href={`/admin/users/${c.link.user.id}`}>{c.link.user.username}</Link> : <span className="text-muted">anonymous</span>}</td>
            <td><span className="badge-blue font-mono">{c.goal}</span></td>
            <td>{c.value ? formatMoney(c.value, currency) : <span className="text-muted">-</span>}</td>
            <td className="text-xs">{c.country ?? "-"}</td>
            <td className="text-xs">{c.device ?? "-"}</td>
            <td className="text-xs font-mono text-muted">{c.clickId ? c.clickId.slice(0, 10) : "none"}</td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/conversions", sp)} />
    </div>
  );
}
