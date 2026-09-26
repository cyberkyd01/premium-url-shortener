import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { pixelProviderLabel } from "@/lib/pixel-providers";
import { formatDate, truncate } from "@/lib/utils";
import { PageHeader, Card, Empty, Alert, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { PixelFormButton } from "./pixel-form";
import { ProviderIcon } from "./provider-icon";
import { deletePixel } from "./actions";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Pixels" };

export default async function PixelsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [{ features, user }, limit, pixels] = await Promise.all([
    getUserPlan(ws.ownerId),
    withinLimit(ws.ownerId, "limitPixels"),
    db.pixel.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { links: true } } } }),
  ]);
  const enabled = user.role === "admin" || features.pixels;
  const canCreate = enabled && limit.ok && can(ws, "pixels", "create");
  return (
    <div>
      <PageHeader title="Retargeting pixels" description="Add tracking pixels and attach them to links. Pixels fire on splash, overlay and frame pages before the visitor is redirected."
        actions={<>{enabled && limit.limit > 0 && <span className="text-sm text-muted">{pixels.length} / {limit.limit} used</span>}{can(ws, "pixels", "create") && enabled && <PixelFormButton disabled={!limit.ok} disabledHint="Pixel limit reached" />}</>} />
      {!enabled && <div className="mb-4"><Alert type="warning">Retargeting pixels are not included in your current plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to add Facebook, Google, TikTok and other pixels to your links.</Alert></div>}
      {enabled && !limit.ok && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit.limit} pixels on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to add more.</Alert></div>}
      <Card>
        {pixels.length === 0 ? (
          <Empty title="No pixels yet" description="Create a pixel and select it when editing a link to retarget your visitors." action={canCreate ? <PixelFormButton /> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Pixel</th><th>Provider</th><th>ID</th><th>Links</th><th>Created</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {pixels.map((p) => (
                  <tr key={p.id}>
                    <td><span className="flex items-center gap-3 font-medium"><ProviderIcon provider={p.provider} />{p.name}</span></td>
                    <td className="text-muted">{pixelProviderLabel(p.provider)}</td>
                    <td className="font-mono text-xs text-muted">{p.provider === "custom" ? "custom script" : truncate(p.pixelId, 36)}</td>
                    <td>{p._count.links}</td>
                    <td className="text-muted">{formatDate(p.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {can(ws, "pixels", "edit") && enabled && <PixelFormButton pixel={{ id: p.id, name: p.name, provider: p.provider, pixelId: p.pixelId }} />}
                        {can(ws, "pixels", "delete") && <ConfirmForm action={deletePixel} hidden={{ id: p.id }} message={`Delete "${p.name}"? It will be detached from ${p._count.links} link(s).`}><Button type="submit" variant="ghost" size="sm" className="text-danger" title="Delete"><Trash2 size={14} /></Button></ConfirmForm>}
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
