import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, formatNumber } from "@/lib/utils";
import { bioUrl } from "@/lib/bio-widgets";
import { firstParam } from "@/lib/social";
import { Section, SectionTitle } from "@/components/public/section";
import { Pagination } from "@/components/ui/pagination";
import { BadgeCheck, Eye, Search, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Bio pages directory", description: "Discover creators, brands and teams sharing their links with bio pages." };

const PER_PAGE = 24;

export default async function BioDirectory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  if (s["bio.enabled"] !== "1") notFound();
  const q = (firstParam(sp, "q") ?? "").trim().slice(0, 80);
  const sort = firstParam(sp, "sort") === "new" ? "new" : "featured";
  const page = Math.max(1, parseInt(firstParam(sp, "page") ?? "1", 10) || 1);
  const where: Prisma.BioPageWhereInput = {
    listed: true, status: "active", isTemplate: false, user: { status: { not: 0 } },
    ...(q ? { OR: [{ name: { contains: q } }, { bio: { contains: q } }, { alias: { contains: q } }] } : {}),
  };
  const [total, pages] = await Promise.all([
    db.bioPage.count({ where }),
    db.bioPage.findMany({ where, orderBy: sort === "new" ? [{ createdAt: "desc" }] : [{ views: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, alias: true, name: true, bio: true, avatar: true, verified: true, views: true, domain: { select: { domain: true } }, user: { select: { username: true } } } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const hrefFor = (p: number) => { const u = new URLSearchParams(); if (q) u.set("q", q); if (sort !== "featured") u.set("sort", sort); if (p > 1) u.set("page", String(p)); const qs = u.toString(); return qs ? `/bio-pages?${qs}` : "/bio-pages"; };
  const base = appUrl("/");
  return (
    <Section className="pt-14">
      <SectionTitle eyebrow="Directory" title="Bio pages directory" description="Discover creators, brands and teams sharing their links. Want to be listed? Enable it in your bio page's SEO settings." />
      <form className="flex flex-wrap gap-2 max-w-xl mx-auto mb-8" action="/bio-pages">
        <div className="relative flex-1 min-w-48"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={q} placeholder="Search by name, bio or alias" className="input pl-9" /></div>
        <select name="sort" defaultValue={sort} className="input w-auto"><option value="featured">Most viewed</option><option value="new">Newest</option></select>
        <button className="btn-primary" type="submit">Search</button>
      </form>
      {pages.length === 0 ? (
        <div className="card p-10 text-center text-muted text-sm">{q ? `No bio pages match "${q}".` : "No bio pages are listed yet."}</div>
      ) : (
        <>
          <p className="text-xs text-muted mb-3">{formatNumber(total)} page{total === 1 ? "" : "s"}{q ? ` matching "${q}"` : ""}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pages.map((p, i) => {
              const url = bioUrl({ alias: p.alias, domain: p.domain }, base);
              const label = url.replace(/^https?:\/\//, "");
              const featured = sort === "featured" && page === 1 && i < 3 && p.views > 0;
              return (
                <a key={p.id} href={url} className="card p-5 flex flex-col items-center text-center hover:border-primary transition group">
                  {featured && <span className="badge-blue mb-3 inline-flex items-center gap-1"><Sparkles size={11} />Featured</span>}
                  {p.avatar ? <img src={p.avatar} alt="" className="h-20 w-20 rounded-full object-cover border border-border" /> : <span className="h-20 w-20 rounded-full bg-primary/10 text-primary grid place-items-center text-2xl font-bold">{(p.name || p.alias).charAt(0).toUpperCase()}</span>}
                  <h2 className="font-semibold mt-3 flex items-center gap-1 group-hover:text-primary">{p.name || p.user.username}{p.verified && <BadgeCheck size={16} className="text-primary" />}</h2>
                  {p.bio && <p className="text-sm text-muted mt-1 line-clamp-3">{p.bio}</p>}
                  <p className="text-xs text-primary mt-3 truncate max-w-full">{label}</p>
                  <p className="text-xs text-muted mt-2 inline-flex items-center gap-1"><Eye size={12} />{formatNumber(p.views)} views</p>
                </a>
              );
            })}
          </div>
          <div className="mt-8"><Pagination page={page} pages={pageCount} hrefFor={hrefFor} /></div>
        </>
      )}
      <p className="text-center text-sm text-muted mt-10">Create your own link-in-bio page <Link href="/register" className="text-primary underline">for free</Link>.</p>
    </Section>
  );
}
