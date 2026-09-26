import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { appUrl, formatDate, formatNumber } from "@/lib/utils";
import { PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { ActionButton } from "@/components/admin/action-button";
import { Table, Ids } from "@/components/admin/table";
import { bulkSharedReports, purgeExpiredReports, sharedReportQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminSharedReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const q = qs(sp, "q"), user = qs(sp, "user"), state = qs(sp, "state"), type = qs(sp, "type");
  const { page, perPage, skip, take } = paging(sp);
  const now = new Date();
  const where: Prisma.SharedReportWhereInput = {
    ...(q ? { OR: [{ title: { contains: q } }, { token: { contains: q } }, { link: { alias: { contains: q } } }] } : {}),
    ...(user ? { user: { OR: [{ username: { contains: user } }, { email: { contains: user } }] } } : {}),
    ...(state === "active" ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : state === "expired" ? { expiresAt: { lte: now } } : state === "protected" ? { password: { not: null } } : {}),
    ...(type === "link" ? { linkId: { not: null } } : type === "campaign" ? { campaignId: { not: null } } : type === "bio" ? { bioPageId: { not: null } } : {}),
  };
  const [reports, total, all, expired, protectedCount, views] = await Promise.all([
    db.sharedReport.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, link: { select: { id: true, alias: true } } } }),
    db.sharedReport.count({ where }),
    db.sharedReport.count(),
    db.sharedReport.count({ where: { expiresAt: { lte: now } } }),
    db.sharedReport.count({ where: { password: { not: null } } }),
    db.sharedReport.aggregate({ _sum: { views: true } }),
  ]);
  const campaignIds = reports.map((r) => r.campaignId).filter((id): id is string => !!id);
  const bioIds = reports.map((r) => r.bioPageId).filter((id): id is string => !!id);
  const [campaigns, bios] = await Promise.all([
    campaignIds.length ? db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    bioIds.length ? db.bioPage.findMany({ where: { id: { in: bioIds } }, select: { id: true, alias: true } }) : Promise.resolve([]),
  ]);
  const targetOf = (r: (typeof reports)[number]) => {
    if (r.link) return { kind: "Link", label: `/${r.link.alias}`, href: `/admin/links/${r.link.id}` };
    if (r.campaignId) return { kind: "Campaign", label: campaigns.find((c) => c.id === r.campaignId)?.name ?? r.campaignId, href: `/admin/campaigns` };
    if (r.bioPageId) return { kind: "Bio page", label: bios.find((b) => b.id === r.bioPageId)?.alias ?? r.bioPageId, href: `/admin/bio` };
    return { kind: "Account", label: "Overall stats", href: r.user ? `/admin/users/${r.user.id}` : "#" };
  };

  return (
    <div>
      <PageHeader title="Shared reports" description={`${formatNumber(all)} public report links created by users`}
        actions={<ActionButton action={purgeExpiredReports} confirm="Delete every expired shared report?"><Trash2 size={14} /> Purge expired ({expired})</ActionButton>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Shared reports" value={formatNumber(all)} />
        <Stat label="Total views" value={formatNumber(views._sum.views ?? 0)} />
        <Stat label="Password protected" value={formatNumber(protectedCount)} />
        <Stat label="Expired" value={formatNumber(expired)} />
      </div>
      <FilterBar fields={[
        { name: "q", value: q, placeholder: "Title, token or link alias" },
        { name: "user", value: user, placeholder: "Owner username or email" },
        { name: "type", type: "select", value: type, options: [{ value: "", label: "All targets" }, { value: "link", label: "Links" }, { value: "campaign", label: "Campaigns" }, { value: "bio", label: "Bio pages" }] },
        { name: "state", type: "select", value: state, options: [{ value: "", label: "Any state" }, { value: "active", label: "Active" }, { value: "expired", label: "Expired" }, { value: "protected", label: "Password protected" }] },
      ]} />
      <BulkForm action={bulkSharedReports} options={[{ value: "expire", label: "Expire now" }, { value: "delete", label: "Delete" }]}>
        <Table count={reports.length} empty="No shared reports match these filters." head={["", "Report", "Owner", "Target", "Views", "Expires", "Protected", "Created", ""]}>
          {reports.map((r) => {
            const t = targetOf(r);
            const url = appUrl(`/share/${r.token}`);
            const isExpired = !!r.expiresAt && r.expiresAt <= now;
            return (
              <tr key={r.id}>
                <td><Ids id={r.id} /></td>
                <td><span className="font-medium">{r.title || "Untitled report"}</span><a href={url} target="_blank" rel="noreferrer" className="block text-xs text-primary font-mono truncate max-w-[16rem]">{url.replace(/^https?:\/\//, "")}</a></td>
                <td>{r.user ? <Link href={`/admin/users/${r.user.id}`}>{r.user.username}</Link> : <span className="text-muted">-</span>}</td>
                <td><span className="badge-gray">{t.kind}</span> <Link href={t.href} className="text-sm">{t.label}</Link></td>
                <td>{formatNumber(r.views)}</td>
                <td className="text-xs whitespace-nowrap">{r.expiresAt ? <span className={isExpired ? "text-danger" : ""}>{formatDate(r.expiresAt, true)}{isExpired && " (expired)"}</span> : <span className="text-muted">never</span>}</td>
                <td>{r.password ? <span className="badge-yellow">password</span> : <span className="badge-green">open</span>}</td>
                <td className="text-muted text-xs whitespace-nowrap">{formatDate(r.createdAt)}</td>
                <td className="whitespace-nowrap space-x-1">
                  <a href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><ExternalLink size={12} /></a>
                  {r.password && <RowAction action={sharedReportQuick} hidden={{ id: r.id, op: "unprotect" }}>Remove password</RowAction>}
                  {!isExpired && <RowAction action={sharedReportQuick} hidden={{ id: r.id, op: "expire" }}>Expire</RowAction>}
                  <RowAction action={sharedReportQuick} hidden={{ id: r.id, op: "delete" }} variant="danger" confirm="Delete this shared report? The public link stops working immediately.">Delete</RowAction>
                </td>
              </tr>
            );
          })}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/shared-reports", sp)} />
    </div>
  );
}
