import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { parseOverlayOptions, overlayTypeLabel, type OverlayType, type OverlayPosition } from "@/components/overlays/overlay-types";
import { PageHeader, Alert, Badge, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { OverlayForm } from "@/components/overlays/overlay-form";
import { deleteOverlay } from "../actions";
import { Trash2, Inbox } from "lucide-react";

export const metadata = { title: "Edit overlay" };

export default async function EditOverlayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [overlay, { features, user }] = await Promise.all([db.overlay.findFirst({ where: { id, userId: ws.ownerId }, include: { _count: { select: { links: true, responses: true } } } }), getUserPlan(ws.ownerId)]);
  if (!overlay) notFound();
  const isAdmin = user.role === "admin";
  const canEdit = can(ws, "overlays", "edit") && (isAdmin || features.overlays);
  const hasResponses = ["contact", "poll", "newsletter"].includes(overlay.type);
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2">{overlay.name}<Badge color="blue">{overlayTypeLabel(overlay.type)}</Badge></span>} description={`Used by ${overlay._count.links} link(s)`}
        actions={<>
          {hasResponses && <Link href={`/dashboard/overlays/${overlay.id}/responses`} className="btn-secondary btn-sm"><Inbox size={14} />Responses ({overlay._count.responses})</Link>}
          {can(ws, "overlays", "delete") && <ConfirmForm action={deleteOverlay} hidden={{ id: overlay.id, redirect: "1" }} message="Delete this overlay and all its responses?"><Button type="submit" variant="danger" size="sm"><Trash2 size={14} />Delete</Button></ConfirmForm>}
        </>} />
      {created && <div className="mb-4"><Alert type="success">Overlay created. Choose it in the link editor under redirect type “Overlay”.</Alert></div>}
      {!canEdit && <div className="mb-4"><Alert type="warning">You cannot edit overlays{!isAdmin && !features.overlays ? " on your current plan" : " with your team permissions"}.</Alert></div>}
      <OverlayForm overlay={{
        id: overlay.id, name: overlay.name, type: overlay.type as OverlayType, position: overlay.position as OverlayPosition, title: overlay.title ?? "", message: overlay.message ?? "",
        buttonText: overlay.buttonText ?? "", buttonUrl: overlay.buttonUrl ?? "", image: overlay.image ?? "", video: overlay.video ?? "",
        bgColor: overlay.bgColor, textColor: overlay.textColor, accentColor: overlay.accentColor, delay: overlay.delay, disclaimer: overlay.disclaimer ?? "", options: parseOverlayOptions(overlay.options),
      }} />
    </div>
  );
}
