import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { cancelSubscription } from "../payments/actions";
import type { Prisma } from "@prisma/client";

export default async function SubscriptionsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("payments.view");
  const sp = await searchParams;
  const q = qs(sp, "q"), status = qs(sp, "status"), gateway = qs(sp, "gateway");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.SubscriptionWhereInput = { ...(q ? { user: { OR: [{ username: { contains: q } }, { email: { contains: q } }] } } : {}), ...(status ? { status } : {}), ...(gateway ? { gateway } : {}) };
  const [rows, total, gateways] = await Promise.all([
    db.subscription.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, plan: { select: { name: true } } } }),
    db.subscription.count({ where }), db.subscription.groupBy({ by: ["gateway"], _count: { _all: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Subscriptions" description={`${total} subscriptions`} />
      <FilterBar fields={[
        { name: "q", value: q, placeholder: "User" },
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, ...["active", "trialing", "cancelled", "past_due", "expired"].map((s) => ({ value: s, label: s }))] },
        { name: "gateway", type: "select", value: gateway, options: [{ value: "", label: "All gateways" }, ...gateways.map((g) => ({ value: g.gateway, label: `${g.gateway} (${g._count._all})` }))] },
      ]} />
      <Table count={rows.length} head={["User", "Plan", "Gateway", "Interval", "Status", "Period end", "Created", ""]}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td><Link href={`/admin/users/${s.user.id}`} className="font-medium">{s.user.username}</Link></td>
            <td>{s.plan.name}</td>
            <td>{s.gateway}{s.gatewaySubId && <span className="block text-xs text-muted font-mono truncate max-w-[140px]">{s.gatewaySubId}</span>}</td>
            <td>{s.interval}</td>
            <td><StatusBadge value={s.status} />{s.cancelAt && <span className="block text-xs text-muted">ends {formatDate(s.cancelAt)}</span>}</td>
            <td>{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "-"}</td>
            <td className="text-muted">{formatDate(s.createdAt)}</td>
            <td className="whitespace-nowrap space-x-1">
              {["active", "trialing", "past_due"].includes(s.status) && <>
                {s.gatewaySubId && <ActionButton action={cancelSubscription} hidden={{ id: s.id, op: "cancel", remote: "1" }} confirm="Cancel at the provider and locally?" showMessage={false}>Cancel (provider)</ActionButton>}
                <ActionButton action={cancelSubscription} hidden={{ id: s.id, op: "cancel" }} confirm="Mark cancelled locally?" showMessage={false}>Cancel</ActionButton>
              </>}
              <ActionButton action={cancelSubscription} hidden={{ id: s.id, op: "delete" }} variant="ghost" confirm="Delete record?" showMessage={false}>Delete</ActionButton>
            </td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/subscriptions", sp)} />
    </div>
  );
}
