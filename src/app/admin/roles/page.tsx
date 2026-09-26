import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { json } from "@/lib/utils";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import { Card, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, CheckboxGroup } from "@/components/admin/fields";
import { Table } from "@/components/admin/table";
import Link from "next/link";
import { saveRole, deleteRole } from "./actions";

export default async function RolesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("roles.manage");
  const editId = qs(await searchParams, "edit");
  const roles = await db.role.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { users: true } } } });
  const editing = editId ? roles.find((r) => r.id === editId) : undefined;
  const perms = editing ? json<string[]>(editing.permissions, []) : [];
  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Custom admin roles. Assign a role to a user on their edit page (the user gets admin access limited to these permissions)." />
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <Table count={roles.length} head={["Role", "Permissions", "Users", ""]}>
            {roles.map((r) => (
              <tr key={r.id}>
                <td><span className="font-medium">{r.name}</span> {r.isAdmin && <span className="badge-blue">full admin</span>}<span className="block text-xs text-muted">{r.slug}{r.description ? ` · ${r.description}` : ""}</span></td>
                <td className="text-xs text-muted">{r.isAdmin ? "All" : json<string[]>(r.permissions, []).length}</td>
                <td><Link href={`/admin/users?role=role:${r.id}`} className="text-primary">{r._count.users}</Link></td>
                <td className="whitespace-nowrap"><Link href={`/admin/roles?edit=${r.id}`} className="btn-secondary btn-sm mr-1">Edit</Link><ActionButton action={deleteRole} hidden={{ id: r.id }} variant="danger" confirm="Delete this role? Users with it become regular users.">Delete</ActionButton></td>
              </tr>
            ))}
          </Table>
        </div>
        <Card className="lg:col-span-2" title={editing ? `Edit role: ${editing.name}` : "Create role"} actions={editing && <Link href="/admin/roles" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveRole} hidden={editing ? { id: editing.id } : undefined} submitLabel={editing ? "Save role" : "Create role"}>
            <Input label="Name" name="name" defaultValue={editing?.name ?? ""} required />
            <Input label="Slug" name="slug" defaultValue={editing?.slug ?? ""} hint="Auto-generated from name if empty" />
            <Textarea label="Description" name="description" defaultValue={editing?.description ?? ""} />
            <SwitchField name="isAdmin" label="Full administrator" hint="Grants every permission regardless of the checkboxes" defaultChecked={editing?.isAdmin} />
            <CheckboxGroup name="permissions" label="Permissions" columns={1} options={ADMIN_PERMISSIONS.map((p) => ({ value: p.key, label: `${p.label} (${p.key})` }))} defaultValues={perms} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
