import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { shortUrl } from "@/lib/links";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { BulkForm } from "@/components/admin/bulk-form";
import { RowAction } from "@/components/admin/row-action";
import { Table, StatusBadge, Ids } from "@/components/admin/table";
import { bulkLinks, linkQuick } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function LinksPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("links.view");
  const sp = await searchParams;
  const q = qs(sp, "q"), status = qs(sp, "status"), user = qs(sp, "user"), domainId = qs(sp, "domain"), from = qs(sp, "from"), to = qs(sp, "to");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.LinkWhereInput = {
    ...(q ? { OR: [{ alias: { contains: q } }, { url: { contains: q } }, { title: { contains: q } }] } : {}),
    ...(status ? { status } : {}),
    ...(user === "anonymous" ? { userId: null } : user ? { user: { OR: [{ username: { contains: user } }, { email: { contains: user } }] } } : {}),
    ...(domainId === "main" ? { domainId: null } : domainId ? { domainId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to + "T23:59:59") } : {}) } } : {}),
  };
  const [links, total, domains, pending] = await Promise.all([
    db.link.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, domain: true } }),
    db.link.count({ where }), db.domain.findMany({ orderBy: { domain: "asc" } }), db.link.count({ where: { status: "pending" } }),
  ]);
  return (
    <div>
      <PageHeader title="Links" description={`${total} links · ${pending} pending approval`} actions={<><Link href="/admin/tools#cleanup" className="btn-secondary">Cleanup</Link><Link href="/admin/links/new" className="btn-primary">Create short link</Link></>} />
      <FilterBar fields={[
        { name: "q", value: q, placeholder: "Alias, URL or title" },
        { name: "status", type: "select", value: status, options: [{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "pending", label: "Pending approval" }, { value: "disabled", label: "Disabled" }, { value: "blocked", label: "Blocked" }] },
        { name: "user", value: user, placeholder: "User (or 'anonymous')" },
        { name: "domain", type: "select", value: domainId, options: [{ value: "", label: "All domains" }, { value: "main", label: "Main domain" }, ...domains.map((d) => ({ value: d.id, label: d.domain }))] },
        { name: "from", type: "date", value: from }, { name: "to", type: "date", value: to },
      ]} />
      <BulkForm action={bulkLinks} options={[{ value: "approve", label: "Approve" }, { value: "enable", label: "Enable" }, { value: "disable", label: "Disable" }, { value: "block", label: "Block" }, { value: "delete", label: "Delete" }]}>
        <Table count={links.length} head={["", "Short link", "Destination", "User", "Clicks", "Status", "Created", ""]}>
          {links.map((l) => (
            <tr key={l.id}>
              <td><Ids id={l.id} /></td>
              <td><Link href={`/admin/links/${l.id}`} className="font-medium">{l.domain?.domain ?? ""}/{l.alias}</Link>{l.title && <span className="block text-xs text-muted truncate max-w-[200px]">{l.title}</span>}</td>
              <td className="max-w-xs"><a href={l.url} target="_blank" rel="noreferrer" className="text-muted truncate block">{l.url}</a></td>
              <td>{l.user ? <Link href={`/admin/users/${l.user.id}`}>{l.user.username}</Link> : <span className="text-muted">anonymous</span>}</td>
              <td>{l.clicks}</td>
              <td><StatusBadge value={l.status} /></td>
              <td className="text-muted">{formatDate(l.createdAt)}</td>
              <td className="whitespace-nowrap space-x-1">
                {l.status === "pending" && <RowAction action={linkQuick} hidden={{ id: l.id, op: "approve" }} variant="primary">Approve</RowAction>}
                <a href={shortUrl(l)} target="_blank" className="btn-ghost btn-sm">Open</a>
                <Link href={`/admin/links/${l.id}`} className="btn-secondary btn-sm">Stats</Link>
              </td>
            </tr>
          ))}
        </Table>
      </BulkForm>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/links", sp)} />
    </div>
  );
}
