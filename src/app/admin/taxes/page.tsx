import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { qs, type SP } from "@/lib/admin/query";
import { Alert, Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveTax, deleteTax } from "./actions";

export default async function TaxesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("plans.manage");
  const editId = qs(await searchParams, "edit");
  const [rows, enabled] = await Promise.all([db.taxRate.findMany({ orderBy: [{ country: "asc" }, { state: "asc" }] }), getSetting("payments.taxEnabled")]);
  const editing = rows.find((r) => r.id === editId);
  return (
    <div>
      <PageHeader title="Tax rates" description="Applied at checkout based on the customer's billing country/state. Use country * for a global fallback." />
      {enabled !== "1" && <div className="mb-4"><Alert type="warning">Taxes are disabled. Enable them in <Link href="/admin/settings?tab=payments" className="underline">Settings → Payments</Link>.</Alert></div>}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Table count={rows.length} head={["Name", "Country", "State", "Rate", "Status", ""]}>
            {rows.map((t) => <tr key={t.id}><td className="font-medium">{t.name}</td><td>{t.country}</td><td>{t.state ?? "-"}</td><td>{t.rate}%</td><td><StatusBadge value={t.active} /></td>
              <td className="whitespace-nowrap space-x-1"><Link href={`/admin/taxes?edit=${t.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteTax} hidden={{ id: t.id }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}
          </Table>
        </div>
        <Card title={editing ? "Edit tax rate" : "Add tax rate"} actions={editing && <Link href="/admin/taxes" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveTax} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save">
            <Input label="Name" name="name" defaultValue={editing?.name ?? ""} placeholder="VAT" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Country (ISO2 or *)" name="country" defaultValue={editing?.country ?? "*"} maxLength={2} />
              <Input label="State / region" name="state" defaultValue={editing?.state ?? ""} placeholder="optional" />
            </div>
            <Input label="Rate (%)" name="rate" type="number" step="0.01" defaultValue={editing?.rate ?? 20} />
            <SwitchField name="active" label="Active" defaultChecked={editing?.active ?? true} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
