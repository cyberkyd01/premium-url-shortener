import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, Empty, Alert, Badge, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { deleteSplash, setDefaultSplash } from "./actions";
import { Plus, Pencil, Trash2, Star, Presentation } from "lucide-react";

export const metadata = { title: "Splash pages" };

export default async function SplashListPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [{ features, user }, limit, pages] = await Promise.all([
    getUserPlan(ws.ownerId),
    withinLimit(ws.ownerId, "limitSplash"),
    db.splashPage.findMany({ where: { userId: ws.ownerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], include: { _count: { select: { links: true } } } }),
  ]);
  const enabled = user.role === "admin" || features.customSplash;
  const canCreate = enabled && limit.ok && can(ws, "splash", "create");
  return (
    <div>
      <PageHeader title="Splash pages" description="Branded interstitial pages shown before visitors reach the destination. Select one when setting a link's redirect type to “Custom splash”."
        actions={<>{enabled && limit.limit > 0 && <span className="text-sm text-muted">{pages.length} / {limit.limit} used</span>}{can(ws, "splash", "create") && enabled && <Link href="/dashboard/splash/new" className={canCreate ? "btn-primary" : "btn-primary opacity-50 pointer-events-none"}><Plus size={16} />New splash page</Link>}</>} />
      {!enabled && <div className="mb-4"><Alert type="warning">Custom splash pages are not included in your current plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to design branded interstitial pages.</Alert></div>}
      {enabled && !limit.ok && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit.limit} splash pages on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to create more.</Alert></div>}
      <Card>
        {pages.length === 0 ? (
          <Empty title="No splash pages yet" description="Create a splash page with your logo, message and call to action." action={canCreate ? <Link href="/dashboard/splash/new" className="btn-primary"><Plus size={16} />New splash page</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Splash page</th><th>Countdown</th><th>Links</th><th>Created</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/dashboard/splash/${p.id}`} className="flex items-center gap-3 font-medium hover:text-primary">
                        <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border border-border" style={{ background: p.bgColor, color: p.textColor }}>{p.logo ? <img src={p.logo} alt="" className="h-6 w-6 object-contain" /> : <Presentation size={16} />}</span>
                        <span>{p.name}{p.title && <span className="block text-xs text-muted font-normal">{p.title}</span>}</span>
                        {p.isDefault && <Badge color="blue">Default</Badge>}
                      </Link>
                    </td>
                    <td className="text-muted">{p.countdown}s</td>
                    <td>{p._count.links}</td>
                    <td className="text-muted">{formatDate(p.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {!p.isDefault && can(ws, "splash", "edit") && enabled && <form action={setDefaultSplash}><input type="hidden" name="id" value={p.id} /><Button type="submit" variant="ghost" size="sm" title="Set as default"><Star size={14} /></Button></form>}
                        {can(ws, "splash", "edit") && <Link href={`/dashboard/splash/${p.id}`} className="btn-ghost btn-sm" title="Edit"><Pencil size={14} /></Link>}
                        {can(ws, "splash", "delete") && <ConfirmForm action={deleteSplash} hidden={{ id: p.id }} message={`Delete "${p.name}"? ${p._count.links} link(s) using it will fall back to the default splash page.`}><Button type="submit" variant="ghost" size="sm" className="text-danger" title="Delete"><Trash2 size={14} /></Button></ConfirmForm>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
