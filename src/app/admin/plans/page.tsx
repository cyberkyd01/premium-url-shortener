import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { Table } from "@/components/admin/table";
import { reorderPlan, syncPlans } from "./actions";

export default async function PlansAdmin() {
  await adminPage("plans.manage");
  const [plans, gateways] = await Promise.all([db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: true, subscriptions: true } } } }), db.paymentGateway.findMany({ where: { enabled: true } })]);
  const syncable = gateways.filter((g) => ["stripe", "paypal", "paddle", "paystack"].includes(g.slug));
  return (
    <div>
      <PageHeader title="Plans" description="Membership plans, limits and features." actions={<>
        {syncable.map((g) => <ActionButton key={g.slug} action={syncPlans} hidden={{ gateway: g.slug }} confirm={`Create/update products and prices on ${g.name}?`}>Sync with {g.name}</ActionButton>)}
        <Link href="/admin/plans/new" className="btn-primary">Create plan</Link>
      </>} />
      <Table count={plans.length} head={["Order", "Plan", "Monthly", "Yearly", "Lifetime", "Users", "Visibility", "Gateways", ""]}>
        {plans.map((p) => (
          <tr key={p.id}>
            <td><ActionForm action={reorderPlan} hidden={{ id: p.id }} submitLabel="↻" className="flex items-center gap-1"><input name="sortOrder" type="number" defaultValue={p.sortOrder} className="input w-16" /></ActionForm></td>
            <td><Link href={`/admin/plans/${p.id}`} className="font-medium">{p.name}</Link> {p.isFree && <span className="badge-gray">free</span>} {p.isFeatured && <span className="badge-blue">featured</span>}<span className="block text-xs text-muted">{p.slug}{p.trialDays ? ` · ${p.trialDays}-day trial` : ""}</span></td>
            <td>{formatMoney(p.priceMonthly, p.currency)}</td><td>{formatMoney(p.priceYearly, p.currency)}</td><td>{p.priceLifetime ? formatMoney(p.priceLifetime, p.currency) : "-"}</td>
            <td><Link href={`/admin/users?plan=${p.id}`}>{p._count.users}</Link> <span className="text-xs text-muted">({p._count.subscriptions} subs)</span></td>
            <td>{p.isPublic ? "public" : "hidden"}</td>
            <td className="text-xs text-muted">{[p.stripePriceMonthly && "stripe", p.paypalPlanMonthly && "paypal", p.paddlePriceMonthly && "paddle", p.paystackPlanMonthly && "paystack"].filter(Boolean).join(", ") || "-"}</td>
            <td><Link href={`/admin/plans/${p.id}`} className="btn-secondary btn-sm">Edit</Link></td>
          </tr>
        ))}
      </Table>
      {syncable.length === 0 && <p className="hint mt-3">Enable Stripe, PayPal, Paddle or Paystack in Payment Gateways to sync plans with the provider.</p>}
    </div>
  );
}
