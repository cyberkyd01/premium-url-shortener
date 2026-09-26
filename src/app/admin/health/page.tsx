import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate, formatNumber } from "@/lib/utils";
import { shortUrl } from "@/lib/links";
import { PageHeader, Stat } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { ActionButton } from "@/components/admin/action-button";
import { Table, StatusBadge } from "@/components/admin/table";
import { bulkHealth, healthQuick, runHealthBatch } from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function HealthBadge({ status }: { status: string }) {
  const color = status === "ok" ? "green" : status === "broken" ? "red" : "gray";
  return <span className={`badge-${color}`}>{status === "ok" ? "Healthy" : status === "broken" ? "Broken" : "Unchecked"}</span>;
}

export default async function AdminHealthPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("dashboard.view");
  const sp = await searchParams;
  const status = qs(sp, "status", "broken"), q = qs(sp, "q"), user = qs(sp, "user");
  const { page, perPage, skip, take } = paging(sp);
  const base: Prisma.LinkWhereInput = { isArchived: false };
  const where: Prisma.LinkWhereInput = {
    ...base,
    ...(status && status !== "all" ? { healthStatus: status } : {}),
    ...(q ? { OR: [{ alias: { contains: q } }, { url: { contains: q } }, { title: { contains: q } }] } : {}),
    ...(user ? { user: { OR: [{ username: { contains: user } }, { email: { contains: user } }] } } : {}),
  };
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [links, total, healthy, broken, unknown, checks24h, lastCheck] = await Promise.all([
    db.link.findMany({ where, orderBy: status === "broken" ? [{ healthCheckedAt: "desc" }] : [{ healthCheckedAt: { sort: "asc", nulls: "first" } }], skip, take, include: { user: { select: { id: true, username: true } }, domain: { select: { domain: true } } } }),
    db.link.count({ where }),
    db.link.count({ where: { ...base, healthStatus: "ok" } }),
    db.link.count({ where: { ...base, healthStatus: "broken" } }),
    db.link.count({ where: { ...base, healthStatus: "unknown" } }),
    db.linkCheck.count({ where: { createdAt: { gte: since24h } } }),
    db.linkCheck.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const all = healthy + broken + unknown;
  const coverage = all ? Math.round(((healthy + broken) / all) * 100) : 0;

  return (
    <div>
      <PageHeader title="Link health" description={`Destination monitoring across the platform · ${formatNumber(all)} active links`}
        actions={<ActionButton action={runHealthBatch} variant="primary" size="sm"><HeartPulse size={14} /> Check next 100 links</ActionButton>} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Healthy" value={<span className="text-success">{formatNumber(healthy)}</span>} sub={<Link href="/admin/health?status=ok" className="text-primary">View</Link>} />
        <Stat label="Broken" value={<span className={broken ? "text-danger" : ""}>{formatNumber(broken)}</span>} sub={<Link href="/admin/health?status=broken" className="text-primary">View</Link>} />
        <Stat label="Unchecked" value={formatNumber(unknown)} sub={<Link href="/admin/health?status=unknown" className="text-primary">View</Link>} />
        <Stat label="Checks (24h)" value={formatNumber(checks24h)} sub={`${coverage}% coverage · last check ${lastCheck ? formatDate(lastCheck.createdAt, true) : "never"}`} />
      </div>
      <FilterBar fields={[
        { name: "status", type: "select", value: status, options: [{ value: "broken", label: "Broken" }, { value: "ok", label: "Healthy" }, { value: "unknown", label: "Unchecked" }, { value: "all", label: "All links" }] },
        { name: "q", value: q, placeholder: "Alias, URL or title" },
        { name: "user", value: user, placeholder: "Owner username or email" },
      ]} />
      <BulkForm action={bulkHealth} options={[{ value: "check", label: "Check now" }, { value: "disable", label: "Disable" }, { value: "enable", label: "Enable" }, { value: "reset", label: "Reset to unchecked" }]}>
        <Table count={links.length} empty={status === "broken" ? "No broken links – everything is reachable." : "No links match these filters."} head={["", "Short link", "Destination", "Owner", "Health", "HTTP", "Last check", "Status", ""]}>
          {links.map((l) => (
            <tr key={l.id}>
              <td><input type="checkbox" name="ids" value={l.id} className="accent-primary" /></td>
              <td><Link href={`/admin/links/${l.id}`} className="font-medium">{l.domain?.domain ?? ""}/{l.alias}</Link>{l.title && <span className="block text-xs text-muted truncate max-w-[200px]">{l.title}</span>}</td>
              <td className="max-w-xs"><a href={l.url} target="_blank" rel="noreferrer" className="text-muted truncate block">{l.url}</a>{l.fallbackUrl && <span className="block text-[11px] text-muted truncate">fallback: {l.fallbackUrl}</span>}</td>
              <td>{l.user ? <Link href={`/admin/users/${l.user.id}`}>{l.user.username}</Link> : <span className="text-muted">anonymous</span>}</td>
              <td><HealthBadge status={l.healthStatus} /></td>
              <td className="font-mono text-xs">{l.healthCode ?? <span className="text-muted">-</span>}</td>
              <td className="text-muted text-xs whitespace-nowrap">{l.healthCheckedAt ? formatDate(l.healthCheckedAt, true) : "never"}</td>
              <td><StatusBadge value={l.status} /></td>
              <td className="whitespace-nowrap space-x-1">
                <RowAction action={healthQuick} hidden={{ id: l.id, op: "check" }}>Check now</RowAction>
                {l.status === "active"
                  ? <RowAction action={healthQuick} hidden={{ id: l.id, op: "disable" }} variant="danger" confirm="Disable this link? Visitors will see the 404/fallback page.">Disable</RowAction>
                  : <RowAction action={healthQuick} hidden={{ id: l.id, op: "enable" }}>Enable</RowAction>}
                <a href={shortUrl(l)} target="_blank" className="btn-ghost btn-sm">Open</a>
              </td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/health", sp)} />
    </div>
  );
}
