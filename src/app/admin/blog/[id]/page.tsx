import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { toDateTimeInput } from "@/lib/admin/query";
import { Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, UploadField } from "@/components/admin/fields";
import { HtmlEditor } from "@/components/admin/html-editor";
import { savePost, deletePost } from "../actions";

export default async function PostForm({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("blog.manage");
  const { id } = await params;
  const post = id === "new" ? null : await db.blogPost.findUnique({ where: { id } });
  if (id !== "new" && !post) notFound();
  const [categories, languages] = await Promise.all([db.blogCategory.findMany({ orderBy: { name: "asc" } }), db.language.findMany({ where: { active: true } })]);
  return (
    <div>
      <PageHeader title={post ? `Edit post: ${post.title}` : "New post"} actions={post && <ActionButton action={deletePost} hidden={{ id: post.id }} variant="danger" confirm="Delete this post?">Delete</ActionButton>} />
      <ActionForm action={savePost} hidden={post ? { id: post.id } : undefined} submitLabel="Save post">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="grid md:grid-cols-2 gap-4 mb-4"><Input label="Title" name="title" defaultValue={post?.title ?? ""} required /><Input label="Slug" name="slug" defaultValue={post?.slug ?? ""} /></div>
              <Textarea label="Excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} className="mb-4" />
              <HtmlEditor name="content" label="Content" defaultValue={post?.content ?? ""} rows={20} />
            </Card>
            <Card title="SEO"><Input label="SEO title" name="seoTitle" defaultValue={post?.seoTitle ?? ""} /><Textarea label="SEO description" name="seoDescription" defaultValue={post?.seoDescription ?? ""} className="mt-3" /></Card>
          </div>
          <div className="space-y-4">
            <Card title="Publishing">
              <div className="space-y-3">
                <SwitchField name="published" label="Published" defaultChecked={post?.published} />
                <Input label="Publish date" name="publishedAt" type="datetime-local" defaultValue={toDateTimeInput(post?.publishedAt)} hint="Empty = now when published" />
                <Select label="Category" name="categoryId" defaultValue={post?.categoryId ?? ""}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                <Input label="Tags" name="tags" defaultValue={post?.tags ?? ""} hint="Comma separated" />
                <Select label="Language" name="language" defaultValue={post?.language ?? "all"}><option value="all">All languages</option>{languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</Select>
              </div>
            </Card>
            <Card title="Featured image"><UploadField name="image" defaultValue={post?.image ?? ""} folder="blog" /></Card>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
