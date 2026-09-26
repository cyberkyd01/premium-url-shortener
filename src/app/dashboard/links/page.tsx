import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Plus, Download, Upload, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { shortUrl } from "@/lib/links";
import { PageHeader } from "@/components/ui";
import { Pagination } from "@/components/ui/pagination";
import { LinksTable, type LinkRow } from "@/components/links/links-table";

export const metadata = { title: "Links" };
const PER_PAGE = 25;
type SP = Record<string, string | undefined>;

export default async function LinksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const { user, features } = await getUserPlan(ws.ownerId);
  const isAdmin = user.role === "admin";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.LinkWhereInput = { userId: ws.ownerId, isArchived: sp.archived === "1" };
  if (q) where.OR = [{ alias: { contains: q } }, { url: { contains: q } }, { title: { contains: q } }];
  if (sp.status) where.status = sp.status;
  if (sp.channel) where.channelId = sp.channel;
  if (sp.campaign) where.campaignId = sp.campaign;
  if (sp.domain) where.domainId = sp.domain === "main" ? null : sp.domain;
  if (sp.pinned === "1") where.isPinned = true;
  const tag = (sp.tag ?? "").trim();
  if (tag) {
    // tags are comma-separated: match whole tags only (first, middle or last position)
    const tagMatch: Prisma.LinkWhereInput = { OR: [{ tags: tag }, { tags: { startsWith: tag + "," } }, { tags: { endsWith: "," + tag } }, { tags: { contains: "," + tag + "," } }] };
    const and: Prisma.LinkWhereInput[] = [tagMatch];
    if (where.OR) { and.push({ OR: where.OR }); delete where.OR; }
    where.AND = and;
  }
  if (sp.from || sp.to) where.createdAt = { ...(sp.from ? { gte: new Date(sp.from) } : {}), ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}) };
  const orderBy: Prisma.LinkOrderByWithRelationInput[] = [{ isPinned: "desc" }, sp.sort === "clicks" ? { clicks: "desc" } : sp.sort === "oldest" ? { createdAt: "asc" } : { createdAt: "desc" }];
  const [total, links, channels, campaigns, domains, pixels, tagRows] = await Promise.all([
    db.link.count({ where }),
    db.link.findMany({ where, orderBy, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { domain: true, channel: true, campaign: true } }),
    db.channel.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    db.campaign.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.domain.findMany({ where: { OR: [{ userId: ws.ownerId }, { isPublic: true }] }, select: { id: true, domain: true } }),
    db.pixel.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true } }),
    db.link.findMany({ where: { userId: ws.ownerId, NOT: { tags: "" } }, select: { tags: true }, take: 2000 }),
  ]);
  const allTags = [...new Set(tagRows.flatMap((r) => r.tags.split(",").map((t) => t.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  const now = new Date();
  const rows: LinkRow[] = links.map((l) => ({
    id: l.id, alias: l.alias, short: shortUrl(l), url: l.url, title: l.title, clicks: l.clicks, uniqueClicks: l.uniqueClicks, createdAt: l.createdAt.toISOString(), status: l.status,
    isArchived: l.isArchived, isPinned: l.isPinned, redirectType: l.redirectType, channel: l.channel ? { name: l.channel.name, color: l.channel.color } : null, campaign: l.campaign ? { name: l.campaign.name } : null,
    domain: l.domain?.domain ?? null, hasPassword: !!l.password, expired: !!l.expiresAt && l.expiresAt < now,
    tags: l.tags.split(",").map((t) => t.trim()).filter(Boolean), scheduled: !!l.activateAt && l.activateAt > now, healthStatus: l.healthStatus,
  }));
  const pages = Math.ceil(total / PER_PAGE);
  const hrefFor = (p: number) => { const u = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => !!e[1])); u.set("page", String(p)); return `/dashboard/links?${u}`; };
  const perms = { edit: can(ws, "links", "edit"), delete: can(ws, "links", "delete"), create: can(ws, "links", "create"), stats: can(ws, "links", "stats"), export: isAdmin || features.export, pixels: isAdmin || features.pixels };

  return (
    <>
      <PageHeader title="Links" description={`${total} link${total === 1 ? "" : "s"}${sp.archived === "1" ? " archived" : ""}`} actions={<>
        {perms.export && <a href="/api/links/export" className="btn-secondary btn-sm"><Download size={14} /> Export</a>}
        <Link href="/dashboard/import" className="btn-secondary btn-sm"><Upload size={14} /> Import</Link>
        {perms.create && <Link href="/dashboard/links/new" className="btn-primary btn-sm"><Plus size={14} /> Shorten link</Link>}
      </>} />
      <form method="get" className="card p-4 mb-4 grid gap-3 md:grid-cols-4 lg:grid-cols-6 text-sm">
        <div className="relative md:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={q} className="input pl-8" placeholder="Search alias, URL or title" /></div>
        <select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Any status</option><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option><option value="blocked">Blocked</option></select>
        <select name="channel" defaultValue={sp.channel ?? ""} className="input"><option value="">Any channel</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="campaign" defaultValue={sp.campaign ?? ""} className="input"><option value="">Any campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="domain" defaultValue={sp.domain ?? ""} className="input"><option value="">Any domain</option><option value="main">Main domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from ?? ""} className="input" title="Created from" />
        <input type="date" name="to" defaultValue={sp.to ?? ""} className="input" title="Created until" />
        <select name="tag" defaultValue={tag} className="input"><option value="">Any tag</option>{allTags.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select name="sort" defaultValue={sp.sort ?? "date"} className="input"><option value="date">Newest first</option><option value="oldest">Oldest first</option><option value="clicks">Most clicks</option></select>
        <label className="flex items-center gap-2"><input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} /> Archived</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="pinned" value="1" defaultChecked={sp.pinned === "1"} /> Pinned only</label>
        <div className="flex gap-2"><button className="btn-primary btn-sm">Filter</button><Link href="/dashboard/links" className="btn-ghost btn-sm">Reset</Link></div>
      </form>
      {tag && <p className="text-sm text-muted mb-3">Filtering by tag <span className="badge-blue">{tag}</span> · <Link href="/dashboard/links" className="text-primary">clear</Link></p>}
      <LinksTable rows={rows} channels={channels} campaigns={campaigns} pixels={pixels} tags={allTags} perms={perms} />
      <Pagination page={page} pages={pages} hrefFor={hrefFor} />
    </>
  );
}
