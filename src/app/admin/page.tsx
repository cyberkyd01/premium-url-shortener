import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getStats } from "@/lib/stats";
import { daysAgo, formatMoney, formatNumber, formatDate } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { systemInfo, formatBytes } from "@/lib/admin/system";
import { ClicksChart, BarsChart } from "@/components/ui/charts";
import { Alert, Card, PageHeader, Stat } from "@/components/ui";
import { StatusBadge } from "@/components/admin/table";
import type { SP } from "@/lib/admin/query";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const denied = typeof sp.denied === "string" ? sp.denied : "";
  const currency = await getSetting("payments.currency");
  const d30 = daysAgo(30), d7 = daysAgo(7), d1 = daysAgo(0);
  const [users, links, bio, qr, clicksToday, clicks7, clicks30, revenue30, activeSubs, pendingLinks, pendingReports, pendingVerifs, openTickets, pendingPayouts, latestUsers, latestLinks, latestPayments, signups, payments30, stats, info] = await Promise.all([
    db.user.count(), db.link.count(), db.bioPage.count(), db.qrCode.count(),
    db.click.count({ where: { createdAt: { gte: d1 }, isBot: false } }), db.click.count({ where: { createdAt: { gte: d7 }, isBot: false } }), db.click.count({ where: { createdAt: { gte: d30 }, isBot: false } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "completed", createdAt: { gte: d30 } } }),
    db.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
    db.link.count({ where: { status: "pending" } }), db.report.count({ where: { status: "pending" } }), db.verificationRequest.count({ where: { status: "pending" } }),
    db.ticket.count({ where: { status: "open" } }), db.affiliatePayout.count({ where: { status: "pending" } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, username: true, email: true, createdAt: true, status: true, plan: { select: { name: true } } } }),
    db.link.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, alias: true, url: true, clicks: true, status: true, createdAt: true } }),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { username: true } }, plan: { select: { name: true } } } }),
    db.user.findMany({ where: { createdAt: { gte: d30 } }, select: { createdAt: true } }),
    db.payment.findMany({ where: { status: "completed", createdAt: { gte: d30 } }, select: { createdAt: true, amount: true } }),
    getStats({}, 30), systemInfo(),
  ]);
  const days: string[] = []; for (let i = 29; i >= 0; i--) days.push(daysAgo(i).toISOString().slice(0, 10));
  const signupsByDay = days.map((date) => ({ date, count: signups.filter((u) => u.createdAt.toISOString().slice(0, 10) === date).length }));
  const revenueByDay = days.map((date) => ({ date, amount: Math.round(payments30.filter((p) => p.createdAt.toISOString().slice(0, 10) === date).reduce((s, p) => s + p.amount, 0) * 100) / 100 }));
  const pending = [
    { label: "Links awaiting approval", n: pendingLinks, href: "/admin/links?status=pending" }, { label: "Abuse reports", n: pendingReports, href: "/admin/reports" },
    { label: "Verification requests", n: pendingVerifs, href: "/admin/verifications" }, { label: "Open tickets", n: openTickets, href: "/admin/tickets" }, { label: "Affiliate payouts", n: pendingPayouts, href: "/admin/affiliates?tab=payouts" },
  ];
  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your platform" />
      {denied && <div className="mb-4"><Alert type="error">You do not have permission to access that section ({denied}).</Alert></div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Users" value={formatNumber(users)} sub={<Link href="/admin/users" className="text-primary">Manage users</Link>} />
        <Stat label="Links" value={formatNumber(links)} sub={`${formatNumber(bio)} bio pages · ${formatNumber(qr)} QR codes`} />
        <Stat label="Clicks today" value={formatNumber(clicksToday)} sub={`${formatNumber(clicks7)} last 7 days · ${formatNumber(clicks30)} last 30 days`} />
        <Stat label="Revenue (30d)" value={formatMoney(revenue30._sum.amount ?? 0, currency)} sub={`${activeSubs} active subscriptions`} />
      </div>
      <div className="grid md:grid-cols-5 gap-4 mb-6">
        {pending.map((p) => <Link key={p.label} href={p.href} className="card p-4 hover:border-primary transition"><p className="text-xs text-muted">{p.label}</p><p className={`text-xl font-bold ${p.n ? "text-warning" : ""}`}>{p.n}</p></Link>)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Clicks (30 days)" className="lg:col-span-1"><ClicksChart data={stats.byDay} /></Card>
        <Card title="Signups (30 days)"><BarsChart data={signupsByDay} xKey="date" dataKey="count" height={260} /></Card>
        <Card title="Revenue (30 days)"><ClicksChart data={revenueByDay} dataKey="amount" /></Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card title="Latest users" actions={<Link href="/admin/users" className="text-sm text-primary">All</Link>}>
          <ul className="divide-y divide-border text-sm">{latestUsers.map((u) => <li key={u.id} className="py-2 flex justify-between gap-2"><span className="truncate"><Link href={`/admin/users/${u.id}`} className="font-medium">{u.username}</Link><span className="text-muted block text-xs">{u.email}</span></span><span className="text-right text-xs text-muted">{u.plan?.name ?? "-"}<br />{formatDate(u.createdAt)}</span></li>)}</ul>
        </Card>
        <Card title="Latest links" actions={<Link href="/admin/links" className="text-sm text-primary">All</Link>}>
          <ul className="divide-y divide-border text-sm">{latestLinks.map((l) => <li key={l.id} className="py-2 flex justify-between gap-2"><span className="truncate"><Link href={`/admin/links/${l.id}`} className="font-medium">/{l.alias}</Link><span className="text-muted block text-xs truncate">{l.url}</span></span><span className="text-right text-xs text-muted">{l.clicks} clicks<br /><StatusBadge value={l.status} /></span></li>)}</ul>
        </Card>
        <Card title="Latest payments" actions={<Link href="/admin/payments" className="text-sm text-primary">All</Link>}>
          <ul className="divide-y divide-border text-sm">{latestPayments.map((p) => <li key={p.id} className="py-2 flex justify-between gap-2"><span className="truncate"><span className="font-medium">{p.user.username}</span><span className="text-muted block text-xs">{p.plan?.name ?? "-"} · {p.gateway}</span></span><span className="text-right text-xs">{formatMoney(p.amount, p.currency)}<br /><StatusBadge value={p.status} /></span></li>)}{latestPayments.length === 0 && <li className="py-2 text-muted">No payments yet.</li>}</ul>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="System information">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">App version</dt><dd>{info.version}</dd>
            <dt className="text-muted">Node.js</dt><dd>{info.node}</dd>
            <dt className="text-muted">Platform</dt><dd>{info.platform}</dd>
            <dt className="text-muted">Environment</dt><dd>{info.env}</dd>
            <dt className="text-muted">Database</dt><dd>{info.db}{info.dbBytes !== null ? ` · ${formatBytes(info.dbBytes)}` : ""}</dd>
            <dt className="text-muted">Uploads</dt><dd>{info.uploads.files} files · {formatBytes(info.uploads.bytes)}</dd>
            <dt className="text-muted">Memory (RSS)</dt><dd>{formatBytes(info.memory)}</dd>
          </dl>
        </Card>
        <Card title="Quick links">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[["/admin/settings", "Settings"], ["/admin/plans", "Plans"], ["/admin/gateways", "Payment gateways"], ["/admin/languages", "Languages"], ["/admin/themes", "Themes"], ["/admin/tools", "Tools & cache"], ["/admin/cron", "Cron jobs"], ["/admin/update", "Update"], ["/admin/links/new", "Create short link"], ["/admin/users/new", "Create user"]].map(([h, l]) => <Link key={h} href={h} className="btn-secondary justify-start">{l}</Link>)}
          </div>
        </Card>
      </div>
    </div>
  );
}
