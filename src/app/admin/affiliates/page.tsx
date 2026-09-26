import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate, formatMoney } from "@/lib/utils";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { LinkTabs } from "@/components/admin/link-tabs";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveAffiliateSettings, earningQuick, payoutQuick } from "./actions";

export default async function AffiliatesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("affiliates.manage");
  const sp = await searchParams;
  const tab = qs(sp, "tab", "affiliates");
  const s = await getSettings();
  const pendingPayouts = await db.affiliatePayout.count({ where: { status: "pending" } });
  const tabs = [{ key: "affiliates", label: "Affiliates", href: "/admin/affiliates" }, { key: "earnings", label: "Earnings", href: "/admin/affiliates?tab=earnings" }, { key: "payouts", label: "Payouts", href: "/admin/affiliates?tab=payouts", badge: pendingPayouts }, { key: "settings", label: "Settings", href: "/admin/affiliates?tab=settings" }];
  return (
    <div>
      <PageHeader title="Affiliates" description="Referral program: commissions, earnings and payouts." />
      <LinkTabs tabs={tabs} active={tab} />
      {tab === "affiliates" && <Affiliates sp={sp} />}
      {tab === "earnings" && <Earnings sp={sp} />}
      {tab === "payouts" && <Payouts sp={sp} />}
      {tab === "settings" && (
        <Card title="Affiliate settings" className="max-w-2xl">
          <ActionForm action={saveAffiliateSettings} submitLabel="Save settings">
            <SwitchField name="affiliate.enabled" label="Affiliate program enabled" defaultChecked={s["affiliate.enabled"] === "1"} />
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Commission" name="affiliate.commission" type="number" step="0.01" defaultValue={s["affiliate.commission"]} />
              <Select label="Commission type" name="affiliate.commissionType" defaultValue={s["affiliate.commissionType"]}><option value="percent">Percent of payment</option><option value="fixed">Fixed amount</option></Select>
              <Select label="Frequency" name="affiliate.frequency" defaultValue={s["affiliate.frequency"]}><option value="first">First payment only</option><option value="recurring">Every payment</option></Select>
              <Input label="Minimum payout" name="affiliate.minPayout" type="number" step="0.01" defaultValue={s["affiliate.minPayout"]} />
              <Input label="Cookie duration (days)" name="affiliate.cookieDays" type="number" defaultValue={s["affiliate.cookieDays"]} />
              <Select label="Referral tag" name="affiliate.tagType" defaultValue={s["affiliate.tagType"]} hint="?ref=CODE or ?ref=username"><option value="code">Affiliate code</option><option value="username">Username</option></Select>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

async function Affiliates({ sp }: { sp: SP }) {
  const q = qs(sp, "q");
  const { page, perPage, skip, take } = paging(sp);
  const where = { referrals: { some: {} }, ...(q ? { OR: [{ username: { contains: q } }, { email: { contains: q } }] } : {}) };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: { affiliateBalance: "desc" }, skip, take, select: { id: true, username: true, email: true, affiliateCode: true, affiliateBalance: true, _count: { select: { referrals: true, affiliateEarnings: true, affiliatePayouts: true } } } }),
    db.user.count({ where }),
  ]);
  const earned = await db.affiliateEarning.groupBy({ by: ["userId"], _sum: { amount: true }, where: { userId: { in: users.map((u) => u.id) } } });
  const earnedMap = new Map(earned.map((e) => [e.userId, e._sum.amount ?? 0]));
  return (
    <>
      <form method="get" className="flex gap-2 mb-4"><input type="hidden" name="tab" value="affiliates" /><input name="q" defaultValue={q} className="input w-64" placeholder="Search user" /><button className="btn-secondary btn-sm">Search</button></form>
      <Table count={users.length} head={["Affiliate", "Code", "Referrals", "Total earned", "Balance", "Payouts"]}>
        {users.map((u) => <tr key={u.id}><td><Link href={`/admin/users/${u.id}`} className="font-medium">{u.username}</Link><span className="block text-xs text-muted">{u.email}</span></td><td className="font-mono text-xs">{u.affiliateCode ?? "-"}</td><td><Link href={`/admin/users?q=`}>{u._count.referrals}</Link></td><td>{formatMoney(earnedMap.get(u.id) ?? 0)}</td><td>{formatMoney(u.affiliateBalance)}</td><td>{u._count.affiliatePayouts}</td></tr>)}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/affiliates", sp)} />
    </>
  );
}

async function Earnings({ sp }: { sp: SP }) {
  const status = qs(sp, "status");
  const { page, perPage, skip, take } = paging(sp);
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([db.affiliateEarning.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } } } }), db.affiliateEarning.count({ where })]);
  const referred = await db.user.findMany({ where: { id: { in: rows.map((r) => r.referredId) } }, select: { id: true, username: true } });
  const refMap = new Map(referred.map((r) => [r.id, r.username]));
  return (
    <>
      <form method="get" className="flex gap-2 mb-4"><input type="hidden" name="tab" value="earnings" /><select name="status" defaultValue={status} className="input w-auto"><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option></select><button className="btn-secondary btn-sm">Filter</button></form>
      <Table count={rows.length} head={["Affiliate", "Referred user", "Amount", "Status", "Date", ""]}>
        {rows.map((e) => <tr key={e.id}><td><Link href={`/admin/users/${e.user.id}`}>{e.user.username}</Link></td><td>{refMap.get(e.referredId) ?? e.referredId}</td><td>{formatMoney(e.amount)}</td><td><StatusBadge value={e.status} /></td><td className="text-muted">{formatDate(e.createdAt)}</td>
          <td className="space-x-1 whitespace-nowrap">{e.status === "pending" && <ActionButton action={earningQuick} hidden={{ id: e.id, op: "approve" }} variant="primary" showMessage={false}>Approve</ActionButton>}<ActionButton action={earningQuick} hidden={{ id: e.id, op: "delete" }} variant="ghost" confirm="Delete earning?" showMessage={false}>Delete</ActionButton></td></tr>)}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/affiliates", sp)} />
    </>
  );
}

async function Payouts({ sp }: { sp: SP }) {
  const status = qs(sp, "status", "pending");
  const { page, perPage, skip, take } = paging(sp);
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([db.affiliatePayout.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true, email: true } } } }), db.affiliatePayout.count({ where })]);
  return (
    <>
      <form method="get" className="flex gap-2 mb-4"><input type="hidden" name="tab" value="payouts" /><select name="status" defaultValue={status} className="input w-auto"><option value="">All</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select><button className="btn-secondary btn-sm">Filter</button></form>
      <Table count={rows.length} head={["Affiliate", "Amount", "Method", "Details", "Status", "Requested", ""]}>
        {rows.map((p) => <tr key={p.id}><td><Link href={`/admin/users/${p.user.id}`}>{p.user.username}</Link><span className="block text-xs text-muted">{p.user.email}</span></td><td>{formatMoney(p.amount)}</td><td>{p.method}</td><td className="text-xs whitespace-pre-wrap max-w-xs">{p.details ?? "-"}</td><td><StatusBadge value={p.status} />{p.paidAt && <span className="block text-xs text-muted">{formatDate(p.paidAt)}</span>}</td><td className="text-muted">{formatDate(p.createdAt)}</td>
          <td className="space-x-1 whitespace-nowrap">{p.status === "pending" && <><ActionButton action={payoutQuick} hidden={{ id: p.id, op: "paid" }} variant="primary" confirm="Mark as paid and email the affiliate?" showMessage={false}>Mark paid</ActionButton><ActionButton action={payoutQuick} hidden={{ id: p.id, op: "reject" }} showMessage={false}>Reject</ActionButton></>}<ActionButton action={payoutQuick} hidden={{ id: p.id, op: "delete" }} variant="ghost" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/affiliates", sp)} />
    </>
  );
}
