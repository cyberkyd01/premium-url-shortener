import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { overlayTypeLabel, overlayPositionLabel } from "@/components/overlays/overlay-types";
import { formatDate } from "@/lib/utils";
import { PageHeader, Card, Empty, Alert, Badge, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { deleteOverlay } from "./actions";
import { Plus, Pencil, Trash2, MessageSquare, Inbox } from "lucide-react";

export const metadata = { title: "Overlays" };

const RESPONSE_TYPES = ["contact", "poll", "newsletter"];

export default async function OverlaysPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [{ features, user }, limit, overlays] = await Promise.all([
    getUserPlan(ws.ownerId),
    withinLimit(ws.ownerId, "limitOverlays"),
    db.overlay.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { links: true, responses: true } } } }),
  ]);
  const enabled = user.role === "admin" || features.overlays;
  const canCreate = enabled && limit.ok && can(ws, "overlays", "create");
  return (
    <div>
      <PageHeader title="Overlays" description="Call-to-action widgets shown on top of the destination page: messages, forms, polls, newsletters, coupons and more."
        actions={<>{enabled && limit.limit > 0 && <span className="text-sm text-muted">{overlays.length} / {limit.limit} used</span>}{can(ws, "overlays", "create") && enabled && <Link href="/dashboard/overlays/new" className={canCreate ? "btn-primary" : "btn-primary opacity-50 pointer-events-none"}><Plus size={16} />New overlay</Link>}</>} />
      {!enabled && <div className="mb-4"><Alert type="warning">Overlays are not included in your current plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to add call-to-action widgets to your links.</Alert></div>}
      {enabled && !limit.ok && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit.limit} overlays on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to create more.</Alert></div>}
      <Card>
        {overlays.length === 0 ? (
          <Empty title="No overlays yet" description="Create an overlay and select it when setting a link's redirect type to “Overlay”." action={canCreate ? <Link href="/dashboard/overlays/new" className="btn-primary"><Plus size={16} />New overlay</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Overlay</th><th>Type</th><th>Position</th><th>Links</th><th>Responses</th><th>Created</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {overlays.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/dashboard/overlays/${o.id}`} className="flex items-center gap-3 font-medium hover:text-primary"><span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border border-border" style={{ background: o.bgColor, color: o.accentColor }}><MessageSquare size={16} /></span><span>{o.name}{o.title && <span className="block text-xs text-muted font-normal">{o.title}</span>}</span></Link></td>
                    <td><Badge color="blue">{overlayTypeLabel(o.type)}</Badge></td>
                    <td className="text-muted">{overlayPositionLabel(o.position)}</td>
                    <td>{o._count.links}</td>
                    <td>{RESPONSE_TYPES.includes(o.type) ? <Link href={`/dashboard/overlays/${o.id}/responses`} className="inline-flex items-center gap-1 hover:text-primary"><Inbox size={14} />{o._count.responses}</Link> : <span className="text-muted">—</span>}</td>
                    <td className="text-muted">{formatDate(o.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {can(ws, "overlays", "edit") && <Link href={`/dashboard/overlays/${o.id}`} className="btn-ghost btn-sm" title="Edit"><Pencil size={14} /></Link>}
                        {can(ws, "overlays", "delete") && <ConfirmForm action={deleteOverlay} hidden={{ id: o.id }} message={`Delete "${o.name}"? ${o._count.responses} response(s) will be deleted and ${o._count.links} link(s) will redirect directly.`}><Button type="submit" variant="ghost" size="sm" className="text-danger" title="Delete"><Trash2 size={14} /></Button></ConfirmForm>}
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
