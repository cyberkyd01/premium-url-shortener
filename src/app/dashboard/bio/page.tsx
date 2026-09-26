import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Pencil, Star, Copy, Trash2, Power, LayoutTemplate } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan, limitOf } from "@/lib/plan";
import { appUrl, formatNumber } from "@/lib/utils";
import { bioUrl } from "@/lib/bio-widgets";
import { Alert, Badge, CopyButton, Empty, PageHeader } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { TemplatePicker } from "@/components/bio/template-picker";
import { deleteBio, setDefaultBio, duplicateBio, toggleBioStatus, saveAsTemplate } from "./actions";

export const metadata = { title: "Bio pages" };

export default async function BioListPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["bio.enabled"] !== "1") return <Alert type="warning">Bio pages are currently disabled.</Alert>;
  const [{ plan, features, user }, pages, dbTemplates] = await Promise.all([
    getUserPlan(ws.ownerId),
    db.bioPage.findMany({ where: { userId: ws.ownerId, isTemplate: false }, include: { domain: true, channel: true, _count: { select: { blocks: true } } }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    db.bioPage.findMany({ where: { isTemplate: true }, select: { id: true, name: true, templateName: true, theme: true, avatar: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const limit = ws.isAdmin || user.role === "admin" ? -1 : limitOf(plan, "limitBioPages");
  const atLimit = limit !== -1 && pages.length >= limit;
  const canCreate = can(ws, "bio", "create") && !atLimit;
  const base = appUrl("/");

  return (
    <div>
      <PageHeader title="Bio pages" description={limit === -1 ? `${pages.length} pages` : `${pages.length} / ${limit} pages used`}
        actions={<TemplatePicker builtIns dbTemplates={dbTemplates.map((t) => ({ id: t.id, name: t.templateName ?? t.name ?? "Template", theme: t.theme, avatar: t.avatar }))} canUseDbTemplates={features.bioTemplates || ws.isAdmin} disabled={!canCreate} />} />
      {atLimit && <div className="mb-4"><Alert type="warning">You reached the bio page limit of your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to create more.</Alert></div>}
      {s["bio.autoCreate"] === "1" && !pages.length && <div className="mb-4"><Alert type="info">A bio page is created automatically for new accounts. Create your first page below to get started.</Alert></div>}
      {!pages.length ? (
        <div className="card"><Empty title="No bio pages yet" description="Create a link-in-bio page to share all your links from one place." /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pages.map((p) => {
            const url = bioUrl(p, base);
            return (
              <div key={p.id} className="card p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  {p.avatar ? <img src={p.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-lg">{(p.name ?? p.alias).slice(0, 1).toUpperCase()}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap"><Link href={`/dashboard/bio/${p.id}`} className="font-semibold truncate hover:underline">{p.name || p.alias}</Link>{p.isDefault && <Badge color="blue">Default</Badge>}{p.status !== "active" && <Badge color="red">Disabled</Badge>}{p.password && <Badge color="yellow">Protected</Badge>}</div>
                    <a href={url} target="_blank" rel="noopener" className="text-xs text-muted truncate block hover:text-primary">{url.replace(/^https?:\/\//, "")}</a>
                    <div className="text-xs text-muted mt-1 flex gap-3"><span>{formatNumber(p.views)} views</span><span>{formatNumber(p.uniqueViews)} unique</span><span>{p._count.blocks} blocks</span>{p.channel && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: p.channel.color }} />{p.channel.name}</span>}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                  <Link href={`/dashboard/bio/${p.id}`} className="btn-secondary btn-sm"><Pencil size={14} />Edit</Link>
                  <Link href={`/dashboard/bio/${p.id}/stats`} className="btn-secondary btn-sm"><BarChart3 size={14} />Stats</Link>
                  <CopyButton text={url} label="Copy URL" />
                  {!p.isDefault && <form action={setDefaultBio}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost btn-sm" title="Set as default"><Star size={14} />Default</button></form>}
                  {canCreate && <form action={duplicateBio}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost btn-sm" title="Duplicate"><Copy size={14} /></button></form>}
                  <form action={toggleBioStatus}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost btn-sm" title={p.status === "active" ? "Disable" : "Enable"}><Power size={14} /></button></form>
                  {ws.isAdmin && <form action={saveAsTemplate}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost btn-sm" title="Save as template"><LayoutTemplate size={14} /></button></form>}
                  {can(ws, "bio", "delete") && <ConfirmForm action={deleteBio} hidden={{ id: p.id }} message="Delete this bio page and all its blocks?"><button className="btn-ghost btn-sm text-danger" title="Delete"><Trash2 size={14} /></button></ConfirmForm>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
