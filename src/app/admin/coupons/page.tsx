import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, toDateInput, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveCoupon, couponQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function CouponsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("plans.manage");
  const sp = await searchParams;
  const q = qs(sp, "q"), kind = qs(sp, "kind"), editId = qs(sp, "edit");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.CouponWhereInput = { ...(q ? { code: { contains: q.toUpperCase() } } : {}), ...(kind === "voucher" ? { isVoucher: true } : kind === "coupon" ? { isVoucher: false } : {}) };
  const [rows, total, plans] = await Promise.all([
    db.coupon.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { plan: { select: { name: true } }, _count: { select: { redemptions: true } } } }),
    db.coupon.count({ where }), db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const editing = editId ? await db.coupon.findUnique({ where: { id: editId } }) : null;
  return (
    <div>
      <PageHeader title="Coupons & Vouchers" description="Coupons discount a checkout; vouchers grant a plan for a number of days without payment." />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FilterBar fields={[{ name: "q", value: q, placeholder: "Code" }, { name: "kind", type: "select", value: kind, options: [{ value: "", label: "All" }, { value: "coupon", label: "Coupons" }, { value: "voucher", label: "Vouchers" }] }]} />
          <Table count={rows.length} head={["Code", "Type", "Value", "Plan", "Uses", "Expires", "Status", ""]}>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><span className="font-mono font-medium">{c.code}</span></td>
                <td>{c.isVoucher ? <span className="badge-blue">voucher</span> : <span className="badge-gray">coupon</span>}</td>
                <td>{c.isVoucher ? `${c.voucherDays} days` : c.type === "percent" ? `${c.amount}%` : c.amount.toFixed(2)}</td>
                <td>{c.plan?.name ?? "Any"}</td>
                <td>{c.uses}{c.maxUses >= 0 ? ` / ${c.maxUses}` : ""} <span className="text-xs text-muted">({c._count.redemptions} redemptions)</span></td>
                <td>{c.expiresAt ? formatDate(c.expiresAt) : "-"}</td>
                <td><StatusBadge value={c.active} /></td>
                <td className="whitespace-nowrap space-x-1">
                  <Link href={`/admin/coupons?edit=${c.id}`} className="btn-secondary btn-sm">Edit</Link>
                  <ActionButton action={couponQuick} hidden={{ id: c.id, op: "toggle" }} showMessage={false}>{c.active ? "Deactivate" : "Activate"}</ActionButton>
                  <ActionButton action={couponQuick} hidden={{ id: c.id, op: "delete" }} variant="danger" confirm="Delete this code?" showMessage={false}>Delete</ActionButton>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/coupons", sp)} />
        </div>
        <Card title={editing ? `Edit ${editing.code}` : "Create coupon / voucher"} actions={editing && <Link href="/admin/coupons" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveCoupon} hidden={editing ? { id: editing.id } : undefined} submitLabel={editing ? "Save" : "Create"}>
            <Input label="Code" name="code" defaultValue={editing?.code ?? ""} placeholder="Auto-generated if empty" hint="Stored uppercase" />
            {!editing && <div className="grid grid-cols-2 gap-3"><Input label="Bulk count" name="count" type="number" defaultValue={1} min={1} max={500} hint="Generate many codes" /><Input label="Prefix" name="prefix" placeholder="PROMO-" /></div>}
            <div className="grid grid-cols-2 gap-3">
              <Select label="Type" name="type" defaultValue={editing?.type ?? "percent"}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></Select>
              <Input label="Amount" name="amount" type="number" step="0.01" defaultValue={editing?.amount ?? 10} />
              <Select label="Plan restriction" name="planId" defaultValue={editing?.planId ?? ""}><option value="">Any plan</option>{plans.filter((p) => !p.isFree).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Input label="Max uses" name="maxUses" type="number" defaultValue={editing?.maxUses ?? -1} hint="-1 = unlimited" />
              <Input label="Expires" name="expiresAt" type="date" defaultValue={toDateInput(editing?.expiresAt)} />
              <Input label="Voucher days" name="voucherDays" type="number" defaultValue={editing?.voucherDays ?? 30} />
            </div>
            <SwitchField name="isVoucher" label="Voucher (grants the selected plan for free)" defaultChecked={editing?.isVoucher} />
            <SwitchField name="active" label="Active" defaultChecked={editing?.active ?? true} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
