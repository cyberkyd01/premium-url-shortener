import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { appHost } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "campaigns", "edit")) redirect(`/dashboard/campaigns/${id}`);
  const [campaign, owner] = await Promise.all([
    db.campaign.findFirst({ where: { id, userId: ws.ownerId } }),
    db.user.findUnique({ where: { id: ws.ownerId }, select: { isPublic: true, bioPages: { where: { isDefault: true }, select: { id: true }, take: 1 } } }),
  ]);
  if (!campaign) notFound();
  const publicReady = !!owner?.isPublic && (owner?.bioPages.length ?? 0) > 0;
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit: ${campaign.name}`} />
      <CampaignForm appHost={appHost()} publicReady={publicReady} campaign={{ id: campaign.id, name: campaign.name, slug: campaign.slug, description: campaign.description, color: campaign.color, isPublic: campaign.isPublic, isRotator: campaign.isRotator, rotatorAlias: campaign.rotatorAlias, rotatorMode: campaign.rotatorMode }} />
    </div>
  );
}
