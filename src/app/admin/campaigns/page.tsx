import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, paging, pagesOf, pageHref, type SP } from "@/lib/admin/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar } from "@/components/admin/filter-bar";
import { ActionButton } from "@/components/admin/action-button";
import { Table } from "@/components/admin/table";
import { deleteCampaign } from "./actions";
import type { Prisma } from "@prisma/client";

export default async function CampaignsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("campaigns.manage");
  const sp = await searchParams;
  const q = qs(sp, "q");
  const { page, perPage, skip, take } = paging(sp);
  const where: Prisma.CampaignWhereInput = q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { user: { username: { contains: q } } }] } : {};
  const [rows, total, channels] = await Promise.all([
    db.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { user: { select: { id: true, username: true } }, _count: { select: { links: true } } } }),
    db.campaign.count({ where }), db.channel.count(),
  ]);
  return (
    <div>
      <PageHeader title="Campaigns" description={`${total} campaigns · ${channels} channels`} />
      <FilterBar fields={[{ name: "q", value: q, placeholder: "Name, slug or user" }]} />
      <Table count={rows.length} head={["Campaign", "User", "Links", "Rotator", "Public", "Created", ""]}>
        {rows.map((c) => (
          <tr key={c.id}>
            <td><span className="inline-block h-3 w-3 rounded-full mr-2 align-middle" style={{ background: c.color }} /><span className="font-medium">{c.name}</span><span className="block text-xs text-muted">{c.slug}</span></td>
            <td><Link href={`/admin/users/${c.user.id}`}>{c.user.username}</Link></td>
            <td><Link href={`/admin/links?q=${encodeURIComponent(c.slug)}`}>{c._count.links}</Link></td>
            <td>{c.isRotator ? `${c.rotatorMode} (/${c.rotatorAlias})` : "-"}</td>
            <td>{c.isPublic ? "yes" : "no"}</td>
            <td className="text-muted">{formatDate(c.createdAt)}</td>
            <td><ActionButton action={deleteCampaign} hidden={{ id: c.id }} variant="danger" confirm="Delete campaign? Links are kept." showMessage={false}>Delete</ActionButton></td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} pages={pagesOf(total, perPage)} hrefFor={pageHref("/admin/campaigns", sp)} />
    </div>
  );
}
