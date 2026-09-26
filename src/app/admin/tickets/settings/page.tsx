import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { TicketTabs } from "@/components/admin/ticket-tabs";
import { saveHelpdeskSettings } from "../actions";

export default async function HelpdeskSettings() {
  await adminPage("settings.manage");
  const [s, admins] = await Promise.all([getSettings(), db.user.findMany({ where: { role: "admin" }, select: { id: true, username: true } })]);
  const on = (k: string, d = "1") => (s[k] ?? d) === "1";
  return (
    <div>
      <PageHeader title="Helpdesk settings" />
      <TicketTabs active="settings" />
      <Card className="max-w-2xl">
        <ActionForm action={saveHelpdeskSettings} submitLabel="Save settings">
          <SwitchField name="helpdesk.enabled" label="Helpdesk enabled" defaultChecked={on("helpdesk.enabled")} />
          <SwitchField name="helpdesk.autoAssign" label="Auto-assign new tickets" defaultChecked={on("helpdesk.autoAssign", "0")} />
          <Select label="Auto-assign to" name="helpdesk.autoAssignTo" defaultValue={s["helpdesk.autoAssignTo"] ?? ""}><option value="">Round-robin between admins</option>{admins.map((a) => <option key={a.id} value={a.id}>{a.username}</option>)}</Select>
          <Select label="Default priority" name="helpdesk.defaultPriority" defaultValue={s["helpdesk.defaultPriority"] ?? "low"}>{["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          <Input label="Auto-close resolved tickets after (days)" name="helpdesk.autoCloseDays" type="number" defaultValue={s["helpdesk.autoCloseDays"] ?? "0"} hint="0 = never" />
          <SwitchField name="helpdesk.allowGuests" label="Allow guests to open tickets (via contact form)" defaultChecked={on("helpdesk.allowGuests", "0")} />
          <SwitchField name="helpdesk.attachments" label="Allow attachments" defaultChecked={on("helpdesk.attachments")} />
          <SwitchField name="helpdesk.rating" label="Let users rate resolved tickets" defaultChecked={on("helpdesk.rating")} />
          <SwitchField name="helpdesk.notifyAdmins" label="Notify admins about new tickets" defaultChecked={on("helpdesk.notifyAdmins")} />
        </ActionForm>
      </Card>
    </div>
  );
}
