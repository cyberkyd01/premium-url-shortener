import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate, formatMoney, daysAgo } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { Card, Input, PageHeader, Select, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { Table, StatusBadge } from "@/components/admin/table";
import { addManualPayment } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("payments.view");
  const sp = await searchParams;
  const q = qs(sp, "q"), gateway = qs(sp, "gateway"), status = qs(sp, "status"), from = qs(sp, "from"), to = qs(sp, "to");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.PaymentWhereInput = {
    ...(q ? { OR: [{ invoiceNumber: { contains: q } }, { transactionId: { contains: q } }, { user: { OR: [{ username: { contains: q } }, { email: { contains: q } }] } }] } : {}),
    ...(gateway ? { gateway } : {}), ...(status ? { status } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
  };
  const [rows, total, gateways, plans, currency, sumAll, sum30, sum7, pendingCount] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, plan: { select: { name: true } } } }),
    db.payment.count({ where }), db.payment.groupBy({ by: ["gateway"], _count: { _all: true } }), db.plan.findMany({ orderBy: { sortOrder: "asc" } }), getSetting("payments.currency"),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "completed" } }), db.payment.aggregate({ _sum: { amount: true }, where: { status: "completed", createdAt: { gte: daysAgo(30) } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "completed", createdAt: { gte: daysAgo(7) } } }), db.payment.count({ where: { status: "pending" } }),
  ]);
  const exportQs = new URLSearchParams({ q, gateway, status, from, to }).toString();
  return (
    <div>
      <PageHeader title="Payments & Invoices" description={`${total} payments`} actions={<a href={`/api/admin/payments/export?${exportQs}`} className="btn-secondary">Export CSV</a>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Revenue (all time)" value={formatMoney(sumAll._sum.amount ?? 0, currency)} />
        <Stat label="Revenue (30 days)" value={formatMoney(sum30._sum.amount ?? 0, currency)} />
        <Stat label="Revenue (7 days)" value={formatMoney(sum7._sum.amount ?? 0, currency)} />
        <Stat label="Pending payments" value={pendingCount} sub="e.g. bank transfers awaiting confirmation" />
      </div>
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <FilterBar fields={[
            { name: "q", value: q, placeholder: "Invoice, transaction, user" },
            { name: "gateway", type: "select", value: gateway, options: [{ value: "", label: "All gateways" }, ...gateways.map((g) => ({ value: g.gateway, label: `${g.gateway} (${g._count._all})` }))] },
            { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, ...["pending", "completed", "failed", "refunded"].map((s) => ({ value: s, label: s }))] },
            { name: "from", type: "date", value: from }, { name: "to", type: "date", value: to },
          ]} />
          <Table count={rows.length} head={["Invoice", "User", "Plan", "Gateway", "Amount", "Status", "Date", ""]}>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/payments/${p.id}`} className="font-medium">{p.invoiceNumber ?? p.id.slice(0, 8)}</Link>{p.transactionId && <span className="block text-xs text-muted font-mono truncate max-w-[140px]">{p.transactionId}</span>}</td>
                <td><Link href={`/admin/users/${p.user.id}`}>{p.user.username}</Link></td>
                <td>{p.plan?.name ?? "-"} <span className="text-xs text-muted">{p.interval}</span></td>
                <td>{p.gateway}</td>
                <td>{formatMoney(p.amount, p.currency)}{p.discount > 0 && <span className="block text-xs text-muted">-{formatMoney(p.discount, p.currency)} {p.couponCode}</span>}</td>
                <td><StatusBadge value={p.status} /></td>
                <td className="text-muted">{formatDate(p.createdAt)}</td>
                <td><Link href={`/admin/payments/${p.id}`} className="btn-secondary btn-sm">View</Link></td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/payments", sp)} />
        </div>
        <Card title="Add manual payment" description="Record an offline payment and optionally activate the plan.">
          <ActionForm action={addManualPayment} submitLabel="Add payment">
            <Input label="User (username or email)" name="user" required />
            <Select label="Plan" name="planId">{plans.filter((p) => !p.isFree).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Interval" name="interval"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="lifetime">Lifetime</option></Select>
              <Input label="Amount" name="amount" type="number" step="0.01" placeholder="plan price" />
              <Input label="Gateway" name="gateway" defaultValue="manual" />
              <Input label="Currency" name="currency" defaultValue={currency} />
            </div>
            <Input label="Transaction ID" name="transactionId" />
            <SwitchField name="complete" label="Mark completed & activate plan" defaultChecked />
            <SwitchField name="notify" label="Send payment email to the user" />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
