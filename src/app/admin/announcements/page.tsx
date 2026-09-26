import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { HtmlEditor } from "@/components/admin/html-editor";
import { LinkTabs } from "@/components/admin/link-tabs";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveAnnouncement, announcementQuick, sendNotification, sendBroadcastEmail } from "./actions";

export default async function AnnouncementsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("notifications.manage");
  const sp = await searchParams;
  const tab = qs(sp, "tab", "announcements"), editId = qs(sp, "edit");
  const [rows, plans, userCount] = await Promise.all([db.announcement.findMany({ orderBy: { createdAt: "desc" } }), db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.user.count({ where: { status: 1 } })]);
  const editing = rows.find((r) => r.id === editId);
  const targets = [{ value: "all", label: `All active users (${userCount})` }, { value: "admins", label: "Administrators" }, ...plans.map((p) => ({ value: `plan:${p.id}`, label: `Plan: ${p.name}` }))];
  return (
    <div>
      <PageHeader title="Announcements & Notifications" />
      <LinkTabs active={tab} tabs={[{ key: "announcements", label: "Announcement bars", href: "/admin/announcements" }, { key: "notify", label: "Send notification", href: "/admin/announcements?tab=notify" }, { key: "email", label: "Send email", href: "/admin/announcements?tab=email" }]} />
      {tab === "announcements" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Table count={rows.length} head={["Title", "Type", "Target", "Status", "Created", ""]}>
              {rows.map((a) => <tr key={a.id}><td><span className="font-medium">{a.title}</span><span className="block text-xs text-muted truncate max-w-xs">{a.content}</span></td><td><StatusBadge value={a.type} /></td><td>{a.target}</td><td><StatusBadge value={a.active} /></td><td className="text-muted">{formatDate(a.createdAt)}</td>
                <td className="space-x-1 whitespace-nowrap"><Link href={`/admin/announcements?edit=${a.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={announcementQuick} hidden={{ id: a.id, op: "toggle" }} showMessage={false}>{a.active ? "Deactivate" : "Activate"}</ActionButton><ActionButton action={announcementQuick} hidden={{ id: a.id, op: "delete" }} variant="danger" confirm="Delete?" showMessage={false}>Delete</ActionButton></td></tr>)}
            </Table>
          </div>
          <Card title={editing ? "Edit announcement" : "New announcement"} actions={editing && <Link href="/admin/announcements" className="btn-ghost btn-sm">New</Link>}>
            <ActionForm key={editing?.id ?? "new"} action={saveAnnouncement} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save">
              <Input label="Title" name="title" defaultValue={editing?.title ?? ""} required />
              <Textarea label="Content" name="content" defaultValue={editing?.content ?? ""} required hint="Plain text or simple HTML" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" name="type" defaultValue={editing?.type ?? "info"}><option value="info">Info</option><option value="warning">Warning</option><option value="success">Success</option></Select>
                <Select label="Show to" name="target" defaultValue={editing?.target ?? "all"}><option value="all">Everyone</option><option value="users">Logged-in users</option><option value="guests">Guests</option><option value="admin">Admins</option></Select>
              </div>
              <SwitchField name="active" label="Active" defaultChecked={editing?.active ?? true} />
              <SwitchField name="dismissible" label="Dismissible" defaultChecked={editing?.dismissible ?? true} />
            </ActionForm>
          </Card>
        </div>
      )}
      {tab === "notify" && (
        <Card title="Send in-app notification" className="max-w-2xl">
          <ActionForm action={sendNotification} submitLabel="Send notification">
            <Select label="Recipients" name="to" defaultValue="all">{targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}<option value="user:">Single user (enter below)</option></Select>
            <Input label="Single user (username or email)" name="single" placeholder="Only used with 'Single user'" />
            <Input label="Title" name="title" required /><Textarea label="Message" name="message" required /><Input label="Link" name="link" placeholder="/dashboard/billing" />
            <Select label="Type" name="type" defaultValue="info"><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option></Select>
          </ActionForm>
        </Card>
      )}
      {tab === "email" && (
        <Card title="Send email to users" description="Sends one email per user through the configured mail provider. {{username}} and {{name}} are replaced." className="max-w-3xl">
          <ActionForm action={sendBroadcastEmail} submitLabel="Send email" confirm="Send this email to all selected users?">
            <Select label="Recipients" name="to" defaultValue="all">{targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
            <Input label="Subject" name="subject" required />
            <HtmlEditor name="body" label="Body" rows={12} />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
