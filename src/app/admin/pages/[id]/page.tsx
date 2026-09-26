import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { HtmlEditor } from "@/components/admin/html-editor";
import { savePage, deletePage } from "../actions";

export default async function PageForm({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("pages.manage");
  const { id } = await params;
  const page = id === "new" ? null : await db.page.findUnique({ where: { id } });
  if (id !== "new" && !page) notFound();
  const languages = await db.language.findMany({ where: { active: true } });
  return (
    <div>
      <PageHeader title={page ? `Edit page: ${page.title}` : "Create page"} actions={page && <ActionButton action={deletePage} hidden={{ id: page.id }} variant="danger" confirm="Delete this page?">Delete</ActionButton>} />
      <ActionForm action={savePage} hidden={page ? { id: page.id } : undefined} submitLabel="Save page">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="grid md:grid-cols-2 gap-4 mb-4"><Input label="Title" name="title" defaultValue={page?.title ?? ""} required /><Input label="Slug" name="slug" defaultValue={page?.slug ?? ""} hint="URL: /slug" /></div>
              <HtmlEditor name="content" label="Content" defaultValue={page?.content ?? ""} />
            </Card>
            <Card title="SEO"><Input label="SEO title" name="seoTitle" defaultValue={page?.seoTitle ?? ""} /><Textarea label="SEO description" name="seoDescription" defaultValue={page?.seoDescription ?? ""} className="mt-3" /></Card>
          </div>
          <Card title="Options">
            <div className="space-y-3">
              <SwitchField name="published" label="Published" defaultChecked={page?.published ?? true} />
              <SwitchField name="showInHeader" label="Show in header menu" defaultChecked={page?.showInHeader} />
              <SwitchField name="showInFooter" label="Show in footer" defaultChecked={page?.showInFooter ?? true} />
              <Select label="Language" name="language" defaultValue={page?.language ?? "all"}><option value="all">All languages</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
            </div>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
