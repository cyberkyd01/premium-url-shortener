import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getStats } from "@/lib/stats";
import { shortUrl } from "@/lib/links";
import { appUrl, formatDate, formatNumber, truncate } from "@/lib/utils";
import { PageHeader, Card, Stat, Empty, Button, Badge } from "@/components/ui";
import { ClicksChart, TopList } from "@/components/ui/charts";
import { ConfirmForm } from "@/components/ui/confirm";
import { ChannelFormButton } from "../channel-form";
import { ChannelTabs } from "./channel-tabs";
import { deleteChannel, removeFromChannel, toggleStar } from "../actions";
import { Star, Trash2, X, ArrowLeft } from "lucide-react";

export const metadata = { title: "Channel" };

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const channel = await db.channel.findFirst({
    where: { id, userId: ws.ownerId },
    include: {
      links: { orderBy: { createdAt: "desc" }, include: { domain: true } },
      qrCodes: { orderBy: { createdAt: "desc" } },
      bioPages: { orderBy: { createdAt: "desc" }, include: { domain: true } },
    },
  });
  if (!channel) notFound();
  const linkIds = channel.links.map((l) => l.id);
  const stats = linkIds.length ? await getStats({ linkIds }, 30) : null;
  const canEdit = can(ws, "campaigns", "edit");
  const canDelete = can(ws, "campaigns", "delete");
  const totalClicks = channel.links.reduce((a, l) => a + l.clicks, 0);
  const totalScans = channel.qrCodes.reduce((a, q) => a + q.scans, 0);
  const totalViews = channel.bioPages.reduce((a, b) => a + b.views, 0);

  const removeButton = (kind: "link" | "qr" | "bio", itemId: string) => canEdit ? (
    <ConfirmForm action={removeFromChannel} hidden={{ channelId: channel.id, kind, itemId }} message="Remove this item from the channel? The item itself is kept.">
      <Button type="submit" variant="ghost" size="sm" title="Remove from channel"><X size={14} /></Button>
    </ConfirmForm>
  ) : null;

  const linksTab = channel.links.length === 0 ? <Empty title="No links in this channel" description="Assign links to this channel from the link editor." /> : (
    <div className="overflow-x-auto"><table className="table">
      <thead><tr><th>Link</th><th>Destination</th><th>Clicks</th><th>Created</th><th></th></tr></thead>
      <tbody>{channel.links.map((l) => (
        <tr key={l.id}>
          <td><Link href={`/dashboard/links/${l.id}`} className="font-medium hover:text-primary">{l.title ? truncate(l.title, 40) : shortUrl(l).replace(/^https?:\/\//, "")}</Link><p className="text-xs text-muted">{shortUrl(l)}</p></td>
          <td className="text-muted max-w-xs truncate">{truncate(l.url, 50)}</td>
          <td>{formatNumber(l.clicks)}</td>
          <td className="text-muted">{formatDate(l.createdAt)}</td>
          <td className="text-right">{removeButton("link", l.id)}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
  const qrTab = channel.qrCodes.length === 0 ? <Empty title="No QR codes in this channel" /> : (
    <div className="overflow-x-auto"><table className="table">
      <thead><tr><th>QR code</th><th>Type</th><th>Scans</th><th>Created</th><th></th></tr></thead>
      <tbody>{channel.qrCodes.map((q) => (
        <tr key={q.id}>
          <td><Link href={`/dashboard/qr/${q.id}`} className="font-medium hover:text-primary flex items-center gap-3">{q.image && <img src={q.image} alt="" className="h-8 w-8 rounded" />}{q.name}</Link></td>
          <td><Badge>{q.type}</Badge></td>
          <td>{formatNumber(q.scans)}</td>
          <td className="text-muted">{formatDate(q.createdAt)}</td>
          <td className="text-right">{removeButton("qr", q.id)}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
  const bioTab = channel.bioPages.length === 0 ? <Empty title="No bio pages in this channel" /> : (
    <div className="overflow-x-auto"><table className="table">
      <thead><tr><th>Bio page</th><th>URL</th><th>Views</th><th>Created</th><th></th></tr></thead>
      <tbody>{channel.bioPages.map((b) => {
        const url = b.domain ? `https://${b.domain.domain}/${b.alias}` : appUrl("/" + b.alias);
        return (
          <tr key={b.id}>
            <td><Link href={`/dashboard/bio/${b.id}`} className="font-medium hover:text-primary flex items-center gap-3">{b.avatar && <img src={b.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}{b.name ?? b.alias}{b.isDefault && <Badge color="blue">Default</Badge>}</Link></td>
            <td className="text-muted"><a href={url} target="_blank" rel="noreferrer" className="hover:text-primary">{url.replace(/^https?:\/\//, "")}</a></td>
            <td>{formatNumber(b.views)}</td>
            <td className="text-muted">{formatDate(b.createdAt)}</td>
            <td className="text-right">{removeButton("bio", b.id)}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );

  return (
    <div>
      <Link href="/dashboard/channels" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-3"><ArrowLeft size={14} />All channels</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="h-4 w-4 rounded-full" style={{ background: channel.color }} />{channel.name}{channel.starred && <Star size={18} className="fill-warning text-warning" />}</span>}
        description={`${channel.links.length} links · ${channel.qrCodes.length} QR codes · ${channel.bioPages.length} bio pages`}
        actions={<>
          {canEdit && <form action={toggleStar}><input type="hidden" name="id" value={channel.id} /><Button type="submit" variant="secondary" size="sm"><Star size={14} className={channel.starred ? "fill-warning text-warning" : ""} />{channel.starred ? "Unstar" : "Star"}</Button></form>}
          {canEdit && <ChannelFormButton channel={{ id: channel.id, name: channel.name, color: channel.color, starred: channel.starred }} />}
          {canDelete && <ConfirmForm action={deleteChannel} hidden={{ id: channel.id, redirect: "1" }} message={`Delete "${channel.name}"? Items will be unassigned but not deleted.`}><Button type="submit" variant="danger" size="sm"><Trash2 size={14} />Delete</Button></ConfirmForm>}
        </>}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Link clicks (all time)" value={formatNumber(totalClicks)} />
        <Stat label="Clicks (30 days)" value={formatNumber(stats?.total ?? 0)} sub={stats ? `${formatNumber(stats.unique)} unique` : undefined} />
        <Stat label="QR scans" value={formatNumber(totalScans)} />
        <Stat label="Bio page views" value={formatNumber(totalViews)} />
      </div>
      {stats && (
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <Card title="Clicks — last 30 days" className="lg:col-span-2"><ClicksChart data={stats.byDay} /></Card>
          <Card title="Top countries"><TopList data={stats.countries.slice(0, 8)} total={stats.total} /></Card>
        </div>
      )}
      <Card>
        <ChannelTabs tabs={[
          { key: "links", label: `Links (${channel.links.length})`, content: linksTab },
          { key: "qr", label: `QR codes (${channel.qrCodes.length})`, content: qrTab },
          { key: "bio", label: `Bio pages (${channel.bioPages.length})`, content: bioTab },
        ]} />
      </Card>
    </div>
  );
}
