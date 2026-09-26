import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { withinLimit } from "@/lib/plan";
import { formatNumber, formatDate } from "@/lib/utils";
import { PageHeader, Card, Empty, Badge, Alert } from "@/components/ui";
import { Plus, Megaphone } from "lucide-react";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [limit, campaigns] = await Promise.all([
    withinLimit(ws.ownerId, "limitCampaigns"),
    db.campaign.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { _count: { select: { links: true } }, links: { select: { clicks: true } } } }),
  ]);
  const canCreate = can(ws, "campaigns", "create") && limit.ok;
  const locked = limit.limit === 0;
  return (
    <div>
      <PageHeader title="Campaigns" description="Group links under one shareable page with aggregated statistics, or rotate traffic between them."
        actions={<>{limit.limit > 0 && <span className="text-sm text-muted">{campaigns.length} / {limit.limit} used</span>}{can(ws, "campaigns", "create") && <Link href="/dashboard/campaigns/new" className={canCreate ? "btn-primary" : "btn-primary opacity-50 pointer-events-none"}><Plus size={16} />New campaign</Link>}</>} />
      {locked && <div className="mb-4"><Alert type="warning">Campaigns are not included in your current plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to create campaigns.</Alert></div>}
      {!locked && !limit.ok && <div className="mb-4"><Alert type="warning">You have reached the limit of {limit.limit} campaigns on your plan. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to create more.</Alert></div>}
      <Card>
        {campaigns.length === 0 ? (
          <Empty title="No campaigns yet" description="Create a campaign and add links to track their combined performance." action={canCreate ? <Link href="/dashboard/campaigns/new" className="btn-primary"><Plus size={16} />New campaign</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Campaign</th><th>Slug</th><th>Links</th><th>Total clicks</th><th>Options</th><th>Created</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/dashboard/campaigns/${c.id}`} className="flex items-center gap-3 font-medium hover:text-primary"><span className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: c.color }}><Megaphone size={14} /></span>{c.name}</Link></td>
                    <td className="text-muted font-mono text-xs">{c.slug}</td>
                    <td>{c._count.links}</td>
                    <td>{formatNumber(c.links.reduce((a, l) => a + l.clicks, 0))}</td>
                    <td><div className="flex gap-1">{c.isPublic && <Badge color="green">Public</Badge>}{c.isRotator && <Badge color="blue">Rotator</Badge>}{!c.isPublic && !c.isRotator && <span className="text-muted text-xs">—</span>}</div></td>
                    <td className="text-muted">{formatDate(c.createdAt)}</td>
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
