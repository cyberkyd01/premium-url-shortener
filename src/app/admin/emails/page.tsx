import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { HtmlEditor } from "@/components/admin/html-editor";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveEmailTemplate, deleteEmailTemplate, sendTemplateTest } from "./actions";

const KNOWN = ["welcome", "verify-email", "reset-password", "two-factor", "team-invite", "payment-received", "plan-expiring", "plan-expired", "link-approved", "contact-form", "affiliate-payout", "ticket-reply", "verification-approved", "bio-contact"];

export default async function EmailTemplatesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("settings.manage");
  const editId = qs(await searchParams, "edit");
  const [rows, languages] = await Promise.all([db.emailTemplate.findMany({ orderBy: [{ slug: "asc" }, { language: "asc" }] }), db.language.findMany({ where: { active: true } })]);
  const editing = rows.find((r) => r.id === editId);
  const missing = KNOWN.filter((k) => !rows.some((r) => r.slug === k));
  return (
    <div>
      <PageHeader title="Email templates" description="Placeholders: {{name}}, {{username}}, {{link}}, {{code}}, {{site_name}}, {{site_url}}, {{amount}}, {{plan}}, {{invoice}}, {{short}}, {{number}}, {{subject}}, {{team}}, {{inviter}}, {{date}}, {{message}}, {{email}}." />
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Table count={rows.length} head={["Slug", "Subject", "Lang", "Status", ""]}>
            {rows.map((t) => <tr key={t.id}><td className="font-mono text-xs">{t.slug}</td><td className="text-sm">{t.subject}</td><td>{t.language}</td><td><StatusBadge value={t.active} /></td><td className="whitespace-nowrap space-x-1"><Link href={`/admin/emails?edit=${t.id}`} className="btn-secondary btn-sm">Edit</Link><ActionButton action={deleteEmailTemplate} hidden={{ id: t.id }} variant="ghost" confirm="Delete template?" showMessage={false}>✕</ActionButton></td></tr>)}
          </Table>
          {missing.length > 0 && <p className="hint mt-2">Missing built-in templates (fallback plain text is used): {missing.join(", ")}</p>}
        </div>
        <div className="lg:col-span-3 space-y-4">
          <Card title={editing ? `Edit: ${editing.slug} (${editing.language})` : "Create template"} actions={editing && <Link href="/admin/emails" className="btn-ghost btn-sm">New</Link>}>
            <ActionForm key={editing?.id ?? "new"} action={saveEmailTemplate} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save template">
              <div className="grid md:grid-cols-3 gap-3">
                <Input label="Slug" name="slug" defaultValue={editing?.slug ?? ""} list="known-slugs" required />
                <datalist id="known-slugs">{KNOWN.map((k) => <option key={k} value={k} />)}</datalist>
                <Select label="Language" name="language" defaultValue={editing?.language ?? "en"}>{languages.length ? languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>) : <option value="en">English</option>}</Select>
                <div className="pt-6"><SwitchField name="active" label="Active" defaultChecked={editing?.active ?? true} /></div>
              </div>
              <Input label="Subject" name="subject" defaultValue={editing?.subject ?? ""} required />
              <HtmlEditor name="body" label="Body (HTML)" defaultValue={editing?.body ?? ""} rows={12} />
            </ActionForm>
          </Card>
          {editing && (
            <Card title="Preview & test">
              <div className="prose-content border border-border rounded-lg p-4 text-sm mb-4" dangerouslySetInnerHTML={{ __html: editing.body }} />
              <ActionForm action={sendTemplateTest} hidden={{ id: editing.id }} submitLabel="Send test" variant="secondary" className="flex items-end gap-2 [&>div:last-child]:mb-0"><Input label="Send to" name="to" type="email" placeholder="defaults to your email" /></ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
