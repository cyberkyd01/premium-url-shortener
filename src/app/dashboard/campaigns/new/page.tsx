import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { withinLimit } from "@/lib/plan";
import { appHost } from "@/lib/utils";
import { PageHeader, Alert } from "@/components/ui";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "campaigns", "create")) redirect("/dashboard/campaigns");
  const limit = await withinLimit(ws.ownerId, "limitCampaigns");
  if (!limit.ok) {
    return <div><PageHeader title="New campaign" /><Alert type="warning">{limit.limit === 0 ? "Campaigns are not included in your plan." : `You have reached the limit of ${limit.limit} campaigns.`} <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to continue.</Alert></div>;
  }
  const owner = await db.user.findUnique({ where: { id: ws.ownerId }, select: { isPublic: true, bioPages: { where: { isDefault: true }, select: { id: true }, take: 1 } } });
  const publicReady = !!owner?.isPublic && (owner?.bioPages.length ?? 0) > 0;
  return (
    <div className="max-w-3xl">
      <PageHeader title="New campaign" description="Group links to share and measure them together." />
      <CampaignForm appHost={appHost()} publicReady={publicReady} />
    </div>
  );
}
