import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField } from "@/components/admin/fields";
import { HtmlEditor } from "@/components/admin/html-editor";
import { saveArticle, deleteArticle } from "../actions";

export default async function ArticleForm({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("help.manage");
  const { id } = await params;
  const a = id === "new" ? null : await db.helpArticle.findUnique({ where: { id } });
  if (id !== "new" && !a) notFound();
  const cats = await db.helpCategory.findMany({ orderBy: { order: "asc" } });
  return (
    <div>
      <PageHeader title={a ? `Edit article: ${a.title}` : "New article"} actions={a && <ActionButton action={deleteArticle} hidden={{ id: a.id }} variant="danger" confirm="Delete article?">Delete</ActionButton>} />
      <ActionForm action={saveArticle} hidden={a ? { id: a.id } : undefined} submitLabel="Save article">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <div className="grid md:grid-cols-2 gap-4 mb-4"><Input label="Title" name="title" defaultValue={a?.title ?? ""} required /><Input label="Slug" name="slug" defaultValue={a?.slug ?? ""} /></div>
            <HtmlEditor name="content" label="Content" defaultValue={a?.content ?? ""} />
          </Card>
          <Card title="Options">
            <div className="space-y-3">
              <Select label="Category" name="categoryId" defaultValue={a?.categoryId ?? ""}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
              <Input label="Order" name="order" type="number" defaultValue={a?.order ?? 0} />
              <SwitchField name="published" label="Published" defaultChecked={a?.published ?? true} />
            </div>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
