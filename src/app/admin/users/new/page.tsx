import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { createUser } from "../actions";

export default async function NewUserPage() {
  await adminPage("users.manage");
  const [plans, roles] = await Promise.all([db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.role.findMany()]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Create user" />
      <Card>
        <ActionForm action={createUser} submitLabel="Create user">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Username" name="username" required />
            <Input label="Email" name="email" type="email" required />
            <Input label="Name" name="name" />
            <Input label="Password" name="password" type="text" required minLength={6} />
            <Select label="Plan" name="planId">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            <Input label="Plan expires" name="planExpires" type="date" hint="Leave empty for no expiry" />
            <Select label="Role" name="role" defaultValue="user"><option value="user">User</option><option value="admin">Administrator</option>{roles.map((r) => <option key={r.id} value={`role:${r.id}`}>{r.name} (custom role)</option>)}</Select>
            <Select label="Status" name="status" defaultValue="1"><option value="1">Active</option><option value="0">Banned</option><option value="2">Pending verification</option></Select>
          </div>
          <SwitchField name="verified" label="Verified badge" />
          <SwitchField name="sendWelcome" label="Send welcome email" defaultChecked />
        </ActionForm>
      </Card>
    </div>
  );
}
