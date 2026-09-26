import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import en from "@/locales/en.json";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { Table, StatusBadge } from "@/components/admin/table";
import { saveLanguage, languageQuick } from "./actions";

export default async function LanguagesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("languages.manage");
  const editId = qs(await searchParams, "edit");
  const langs = await db.language.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { strings: true } } } });
  const editing = langs.find((l) => l.id === editId);
  const total = Object.keys(en).length;
  return (
    <div>
      <PageHeader title="Languages" description={`${total} translatable strings in the base English pack.`} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Table count={langs.length} head={["Language", "Code", "Translated", "RTL", "Status", ""]}>
            {langs.map((l) => (
              <tr key={l.id}>
                <td><span className="mr-1">{l.flag}</span><Link href={`/admin/languages/${l.code}`} className="font-medium">{l.name}</Link>{l.isDefault && <span className="badge-blue ml-2">default</span>}</td>
                <td className="font-mono">{l.code}</td>
                <td>{l._count.strings} / {total} <span className="text-xs text-muted">({Math.min(100, Math.round((l._count.strings / Math.max(1, total)) * 100))}%)</span></td>
                <td>{l.rtl ? "yes" : "no"}</td>
                <td><StatusBadge value={l.active} /></td>
                <td className="space-x-1 whitespace-nowrap">
                  <Link href={`/admin/languages/${l.code}`} className="btn-primary btn-sm">Translate</Link>
                  <Link href={`/admin/languages?edit=${l.id}`} className="btn-secondary btn-sm">Edit</Link>
                  {!l.isDefault && <ActionButton action={languageQuick} hidden={{ id: l.id, op: "default" }} showMessage={false}>Set default</ActionButton>}
                  <ActionButton action={languageQuick} hidden={{ id: l.id, op: "toggle" }} showMessage={false}>{l.active ? "Disable" : "Enable"}</ActionButton>
                  {!l.isDefault && <ActionButton action={languageQuick} hidden={{ id: l.id, op: "delete" }} variant="danger" confirm="Delete language and its translations?" showMessage={false}>Delete</ActionButton>}
                </td>
              </tr>
            ))}
          </Table>
        </div>
        <Card title={editing ? `Edit ${editing.name}` : "Add language"} actions={editing && <Link href="/admin/languages" className="btn-ghost btn-sm">New</Link>}>
          <ActionForm key={editing?.id ?? "new"} action={saveLanguage} hidden={editing ? { id: editing.id } : undefined} submitLabel="Save">
            <div className="grid grid-cols-3 gap-3"><Input label="Code" name="code" defaultValue={editing?.code ?? ""} placeholder="fr" required className="col-span-1" /><Input label="Name" name="name" defaultValue={editing?.name ?? ""} placeholder="Français" required className="col-span-2" /></div>
            <Input label="Flag emoji" name="flag" defaultValue={editing?.flag ?? ""} placeholder="🇫🇷" />
            <SwitchField name="rtl" label="Right-to-left" defaultChecked={editing?.rtl} />
            <SwitchField name="active" label="Active" defaultChecked={editing?.active ?? true} />
            <SwitchField name="isDefault" label="Default language" defaultChecked={editing?.isDefault} />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
