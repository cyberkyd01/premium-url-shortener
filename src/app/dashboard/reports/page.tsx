import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Lock, Mail, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { appUrl, formatDate, formatNumber } from "@/lib/utils";
import { PageHeader, Card, CopyButton, Badge, Alert, Empty } from "@/components/ui";
import { ReportFrequencyForm } from "@/components/premium/report-frequency-form";
import { ShareReportForm } from "@/components/premium/share-report-form";
import { ActionButton } from "@/components/premium/action-button";
import { createSharedReport, deleteSharedReport, setReportFrequency, sendTestDigest } from "./actions";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [me, reports, links, campaigns, bioPages] = await Promise.all([
    db.user.findUnique({ where: { id: ws.userId }, select: { reportFrequency: true, reportSentAt: true, email: true } }),
    db.sharedReport.findMany({ where: { userId: ws.ownerId }, orderBy: { createdAt: "desc" }, include: { link: { select: { alias: true, title: true } } } }),
    db.link.findMany({ where: { userId: ws.ownerId, isArchived: false }, select: { id: true, alias: true, title: true }, orderBy: { clicks: "desc" }, take: 500 }),
    db.campaign.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.bioPage.findMany({ where: { userId: ws.ownerId }, select: { id: true, alias: true, name: true }, orderBy: { views: "desc" } }),
  ]);
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));
  const bioNames = new Map(bioPages.map((b) => [b.id, b.name || "/" + b.alias]));
  const canShare = can(ws, "links", "stats");
  const now = new Date();

  return (
    <>
      <PageHeader title="Reports" description="Share live analytics pages with clients and receive a summary of your traffic by email." />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Email digest" description="A summary of clicks, top links, countries and referrers." className="lg:col-span-2">
          <ReportFrequencyForm value={me?.reportFrequency ?? "none"} action={setReportFrequency} lastSentAt={me?.reportSentAt ? formatDate(me.reportSentAt, true) : null} />
        </Card>
        <Card title="Preview">
          <p className="text-sm text-muted mb-3">Send yourself the weekly digest right now to see what it looks like. It goes to <b className="text-fg">{me?.email}</b>.</p>
          <ActionButton action={sendTestDigest} variant="secondary"><Mail size={14} /> Send test digest</ActionButton>
        </Card>
      </div>

      {canShare ? (
        <Card title="Create a shareable report" description="Anyone with the link can view the analytics page, no account needed. Protect it with a password or an expiry date." className="mb-4">
          <ShareReportForm action={createSharedReport} links={links.map((l) => ({ id: l.id, label: `/${l.alias}${l.title ? ` · ${l.title}` : ""}` }))} campaigns={campaigns.map((c) => ({ id: c.id, label: c.name }))} bioPages={bioPages.map((b) => ({ id: b.id, label: `${b.name || "Bio page"} (/${b.alias})` }))} />
        </Card>
      ) : <div className="mb-4"><Alert type="warning">You do not have permission to share statistics in this team.</Alert></div>}

      <Card title="Shared reports" description={`${reports.length} share link${reports.length === 1 ? "" : "s"}`}>
        {reports.length === 0 ? <Empty title="No shared reports yet" description="Create one above and send the URL to a client or teammate." /> : (
          <div className="overflow-x-auto -m-5"><table className="table">
            <thead><tr><th>Report</th><th>Share URL</th><th>Views</th><th>Protection</th><th>Created</th><th className="text-right"></th></tr></thead>
            <tbody>{reports.map((r) => {
              const url = appUrl("/share/" + r.token);
              const subject = r.linkId ? `/${r.link?.alias ?? "?"}${r.link?.title ? ` · ${r.link.title}` : ""}` : r.campaignId ? `Campaign: ${campaignNames.get(r.campaignId) ?? "deleted"}` : r.bioPageId ? `Bio: ${bioNames.get(r.bioPageId) ?? "deleted"}` : "-";
              const expired = !!r.expiresAt && r.expiresAt < now;
              return (
                <tr key={r.id}>
                  <td><div className="font-medium">{r.title || subject}</div>{r.title && <div className="text-xs text-muted">{subject}</div>}</td>
                  <td className="text-xs"><div className="flex items-center gap-1"><a href={url} target="_blank" rel="noreferrer" className="text-primary truncate max-w-[14rem]">{url.replace(/^https?:\/\//, "")}</a><CopyButton text={url} /><Link href={`/share/${r.token}`} target="_blank" className="btn-ghost btn-sm"><ExternalLink size={12} /></Link></div></td>
                  <td className="text-xs">{formatNumber(r.views)}</td>
                  <td className="text-xs space-x-1">
                    {r.password && <Badge color="blue"><Lock size={10} className="mr-1" />password</Badge>}
                    {r.expiresAt && <Badge color={expired ? "red" : "yellow"}>{expired ? "expired" : `until ${formatDate(r.expiresAt)}`}</Badge>}
                    {!r.password && !r.expiresAt && <Badge color="green">public</Badge>}
                  </td>
                  <td className="text-xs text-muted whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="text-right"><ActionButton action={deleteSharedReport} hidden={{ id: r.id }} variant="ghost" confirm="Delete this share link? Anyone using it will lose access." showMessage={false}><Trash2 size={12} /></ActionButton></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
