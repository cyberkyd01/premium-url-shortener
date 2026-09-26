import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { json, formatDate } from "@/lib/utils";
import { PageHeader, Card, Alert, Empty } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { TemplateForm } from "@/components/links/template-form";
import { deleteTemplate } from "./actions";

export const metadata = { title: "Parameter templates" };

export default async function ParametersPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { edit } = await searchParams;
  const { user, features } = await getUserPlan(ws.ownerId);
  const allowed = user.role === "admin" || features.parameterTemplates;
  const templates = (await db.parameterTemplate.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" } })).map((t) => ({ id: t.id, name: t.name, params: json<Record<string, string>>(t.params, {}), createdAt: t.createdAt }));
  const editing = edit ? templates.find((t) => t.id === edit) : undefined;
  return (
    <>
      <PageHeader title="Parameter templates" description="Reusable UTM and custom parameter sets you can apply when creating links." />
      {!allowed && <div className="mb-4"><Alert type="warning">Parameter templates are not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to unlock them.</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={editing ? `Edit “${editing.name}”` : "New template"} className="lg:col-span-1">{allowed ? <TemplateForm template={editing} /> : <p className="text-sm text-muted">Upgrade to create templates.</p>}</Card>
        <Card title="Your templates" className="lg:col-span-2">
          {templates.length === 0 ? <Empty title="No templates yet" description="Create a template to reuse parameters across links." /> : (
            <div className="overflow-x-auto -m-5"><table className="table">
              <thead><tr><th>Name</th><th>Parameters</th><th>Created</th><th className="text-right">Actions</th></tr></thead>
              <tbody>{templates.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td>
                  <td><div className="flex flex-wrap gap-1">{Object.entries(t.params).map(([k, v]) => <span key={k} className="badge-gray font-mono">{k}={v}</span>)}</div></td>
                  <td className="text-xs text-muted whitespace-nowrap">{formatDate(t.createdAt)}</td>
                  <td><div className="flex justify-end gap-1">
                    <Link href={`/dashboard/parameters?edit=${t.id}`} className="btn-ghost btn-sm !px-2" title="Edit"><Pencil size={14} /></Link>
                    <ConfirmForm action={deleteTemplate} hidden={{ id: t.id }} message="Delete this template?"><button className="btn-ghost btn-sm !px-2 text-danger" title="Delete"><Trash2 size={14} /></button></ConfirmForm>
                  </div></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
    </>
  );
}
