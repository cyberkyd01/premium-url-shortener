import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getStats } from "@/lib/stats";
import { shortUrl } from "@/lib/links";
import { appUrl, formatDate, formatNumber, truncate } from "@/lib/utils";
import { PageHeader, Card, Stat, Empty, Button, Badge, CopyButton, Alert } from "@/components/ui";
import { ClicksChart, TopList, DonutChart } from "@/components/ui/charts";
import { ConfirmForm } from "@/components/ui/confirm";
import { AddLinksButton } from "@/components/campaigns/add-links";
import { deleteCampaign, removeLinkFromCampaign } from "../actions";
import { ArrowLeft, Pencil, Trash2, X, ExternalLink } from "lucide-react";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const campaign = await db.campaign.findFirst({ where: { id, userId: ws.ownerId }, include: { links: { orderBy: { clicks: "desc" }, include: { domain: true } } } });
  if (!campaign) notFound();
  const linkIds = campaign.links.map((l) => l.id);
  const [stats, available, owner] = await Promise.all([
    linkIds.length ? getStats({ linkIds }, 30) : null,
    db.link.findMany({ where: { userId: ws.ownerId, OR: [{ campaignId: null }, { campaignId: { not: id } }], isArchived: false }, orderBy: { createdAt: "desc" }, take: 500, include: { domain: true } }),
    db.user.findUnique({ where: { id: ws.ownerId }, select: { isPublic: true, bioPages: { where: { isDefault: true }, select: { id: true }, take: 1 } } }),
  ]);
  const canEdit = can(ws, "campaigns", "edit");
  const canDelete = can(ws, "campaigns", "delete");
  const totalClicks = campaign.links.reduce((a, l) => a + l.clicks, 0);
  const publicUrl = appUrl("/campaign/" + campaign.slug);
  const rotatorUrl = campaign.rotatorAlias ? appUrl("/" + campaign.rotatorAlias) : null;
  const publicReady = !!owner?.isPublic && (owner?.bioPages.length ?? 0) > 0;
  return (
    <div>
      <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-3"><ArrowLeft size={14} />All campaigns</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="h-4 w-4 rounded-full" style={{ background: campaign.color }} />{campaign.name}{campaign.isPublic && <Badge color="green">Public</Badge>}{campaign.isRotator && <Badge color="blue">Rotator</Badge>}</span>}
        description={campaign.description ?? `${campaign.links.length} links · created ${formatDate(campaign.createdAt)}`}
        actions={<>
          {canEdit && <Link href={`/dashboard/campaigns/${campaign.id}/edit`} className="btn-secondary btn-sm"><Pencil size={14} />Edit</Link>}
          {canDelete && <ConfirmForm action={deleteCampaign} hidden={{ id: campaign.id }} message="Delete this campaign? Links will be kept and keep working."><Button type="submit" variant="danger" size="sm"><Trash2 size={14} />Delete</Button></ConfirmForm>}
        </>}
      />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card title="Shareable campaign page" description={campaign.isPublic ? "Anyone with this link can see the campaign's links." : "Enable \"public\" in the campaign settings to share this page."}>
          <div className="flex items-center gap-2"><code className="flex-1 text-sm truncate bg-bg rounded-lg px-3 py-2">{publicUrl}</code><CopyButton text={publicUrl} />{campaign.isPublic && <a href={publicUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm"><ExternalLink size={14} /></a>}</div>
          {campaign.isPublic && !publicReady && <div className="mt-3"><Alert type="warning">Public campaign pages require a default bio page and a public account. <Link href="/dashboard/settings" className="underline">Update your settings</Link>.</Alert></div>}
        </Card>
        <Card title="Rotator link" description={campaign.isRotator ? `Mode: ${campaign.rotatorMode}. Each visit is sent to one of the campaign's links.` : "Enable the link rotator in the campaign settings to get a rotating short link."}>
          {rotatorUrl ? <div className="flex items-center gap-2"><code className="flex-1 text-sm truncate bg-bg rounded-lg px-3 py-2">{rotatorUrl}</code><CopyButton text={rotatorUrl} /></div> : <p className="text-sm text-muted">Not enabled.</p>}
        </Card>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Links" value={campaign.links.length} />
        <Stat label="Total clicks" value={formatNumber(totalClicks)} sub="all time" />
        <Stat label="Clicks (30 days)" value={formatNumber(stats?.total ?? 0)} />
        <Stat label="Unique (30 days)" value={formatNumber(stats?.unique ?? 0)} />
      </div>
      {stats && (
        <>
          <Card title="Clicks — last 30 days" className="mb-4"><ClicksChart data={stats.byDay} /></Card>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card title="Top countries"><TopList data={stats.countries.slice(0, 8)} total={stats.total} /></Card>
            <Card title="Referrers"><TopList data={stats.referers.slice(0, 8)} total={stats.total} /></Card>
            <Card title="Devices">{stats.devices.length ? <><DonutChart data={stats.devices} height={180} /><TopList data={stats.devices} total={stats.total} /></> : <p className="text-sm text-muted">No data yet.</p>}</Card>
          </div>
        </>
      )}
      <Card title={`Links (${campaign.links.length})`} actions={canEdit ? <AddLinksButton campaignId={campaign.id} links={available.map((l) => ({ id: l.id, short: shortUrl(l), title: l.title, url: l.url, clicks: l.clicks }))} /> : undefined}>
        {campaign.links.length === 0 ? (
          <Empty title="No links in this campaign" description="Add existing links or assign this campaign when creating a link." />
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="table">
              <thead><tr><th>Short link</th><th>Destination</th><th>Clicks</th><th>Unique</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {campaign.links.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/dashboard/links/${l.id}`} className="font-medium hover:text-primary">{l.title ? truncate(l.title, 40) : shortUrl(l).replace(/^https?:\/\//, "")}</Link><p className="text-xs text-muted">{shortUrl(l)}</p></td>
                    <td className="text-muted max-w-xs truncate">{truncate(l.url, 50)}</td>
                    <td>{formatNumber(l.clicks)}</td>
                    <td>{formatNumber(l.uniqueClicks)}</td>
                    <td className="text-muted">{formatDate(l.createdAt)}</td>
                    <td className="text-right">{canEdit && <ConfirmForm action={removeLinkFromCampaign} hidden={{ campaignId: campaign.id, linkId: l.id }} message="Remove this link from the campaign? The link keeps working."><Button type="submit" variant="ghost" size="sm" title="Remove"><X size={14} /></Button></ConfirmForm>}</td>
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
