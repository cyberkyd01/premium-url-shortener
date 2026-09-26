import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatDate, formatMoney, json } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/admin/action-button";
import { StatusBadge } from "@/components/admin/table";
import { paymentQuick } from "../actions";

export default async function PaymentView({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("payments.view");
  const { id } = await params;
  const p = await db.payment.findUnique({ where: { id }, include: { user: true, plan: true } });
  if (!p) notFound();
  const billing = json<Record<string, string>>(p.billingInfo, {});
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Payment ${p.invoiceNumber ?? p.id}`} description={<StatusBadge value={p.status} />}
        actions={<>
          {p.status === "pending" && <><ActionButton action={paymentQuick} hidden={{ id, op: "complete" }} variant="primary" confirm="Mark as completed and activate the plan?">Mark completed</ActionButton><ActionButton action={paymentQuick} hidden={{ id, op: "fail" }}>Mark failed</ActionButton></>}
          {p.status === "completed" && <><ActionButton action={paymentQuick} hidden={{ id, op: "refund", remote: "1" }} confirm="Refund at the provider (if supported) and downgrade the user?">Refund (provider)</ActionButton><ActionButton action={paymentQuick} hidden={{ id, op: "refund" }} confirm="Mark refunded locally and downgrade the user?">Mark refunded</ActionButton></>}
          <ActionButton action={paymentQuick} hidden={{ id, op: "delete" }} variant="danger" confirm="Delete this payment record?">Delete</ActionButton>
          <a href={`/dashboard/billing/invoice/${p.id}`} target="_blank" className="btn-secondary btn-sm">Invoice</a>
        </>} />
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Details">
          <dl className="text-sm grid grid-cols-2 gap-y-2">
            <dt className="text-muted">User</dt><dd><Link href={`/admin/users/${p.user.id}`} className="text-primary">{p.user.username}</Link><span className="block text-xs text-muted">{p.user.email}</span></dd>
            <dt className="text-muted">Plan</dt><dd>{p.plan?.name ?? "-"} ({p.interval})</dd>
            <dt className="text-muted">Gateway</dt><dd>{p.gateway}</dd>
            <dt className="text-muted">Transaction</dt><dd className="font-mono text-xs break-all">{p.transactionId ?? "-"}</dd>
            <dt className="text-muted">Amount</dt><dd>{formatMoney(p.amount, p.currency)}</dd>
            <dt className="text-muted">Tax</dt><dd>{formatMoney(p.tax, p.currency)}</dd>
            <dt className="text-muted">Discount</dt><dd>{formatMoney(p.discount, p.currency)} {p.couponCode && <span className="font-mono text-xs">({p.couponCode})</span>}</dd>
            <dt className="text-muted">Date</dt><dd>{formatDate(p.createdAt, true)}</dd>
          </dl>
        </Card>
        <Card title="Billing information">
          {Object.keys(billing).length === 0 ? <p className="text-sm text-muted">No billing details.</p> : <dl className="text-sm grid grid-cols-2 gap-y-2">{Object.entries(billing).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
          <p className="hint mt-3">Current user plan: {p.user.planId === p.planId ? "this plan" : "different plan"}{p.user.planExpires ? `, expires ${formatDate(p.user.planExpires)}` : ""}.</p>
        </Card>
      </div>
    </div>
  );
}
