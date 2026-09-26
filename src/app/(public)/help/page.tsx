import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { firstParam } from "@/lib/social";
import { BookOpen, Search } from "lucide-react";

export const metadata: Metadata = { title: "Help Center", description: "Guides and answers about short links, bio pages, QR codes, domains, billing and the API." };

export default async function HelpIndex({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  if (s["help.enabled"] !== "1") notFound();
  const q = (firstParam(sp, "q") ?? "").trim();
  const [categories, popular, results] = await Promise.all([
    db.helpCategory.findMany({ orderBy: { order: "asc" }, include: { articles: { where: { published: true }, orderBy: { order: "asc" }, select: { id: true, title: true, slug: true } } } }),
    db.helpArticle.findMany({ where: { published: true }, orderBy: [{ views: "desc" }, { helpful: "desc" }], take: 6, include: { category: { select: { slug: true } } } }),
    q ? db.helpArticle.findMany({ where: { published: true, OR: [{ title: { contains: q } }, { content: { contains: q } }] }, take: 30, include: { category: { select: { slug: true, name: true } } } }) : Promise.resolve([]),
  ]);
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold">How can we help?</h1>
        <form action="/help" className="relative max-w-xl mx-auto mt-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Search articles..." className="input pl-10 py-3" aria-label="Search help articles" />
        </form>
      </div>
      {q ? (
        <section>
          <h2 className="font-semibold mb-3">{results.length} result{results.length === 1 ? "" : "s"} for "{q}"</h2>
          {results.length ? (
            <ul className="card divide-y divide-border">
              {results.map((a) => (
                <li key={a.id} className="p-4">
                  <Link href={`/help/${a.category?.slug ?? "general"}/${a.slug}`} className="font-medium hover:text-primary">{a.title}</Link>
                  {a.category && <p className="text-xs text-muted mt-0.5">{a.category.name}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="text-muted">Nothing found. Try different keywords or <Link href="/contact" className="text-primary">contact us</Link>.</p>}
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.filter((c) => c.articles.length > 0).map((c) => (
              <div key={c.id} className="card p-5">
                <div className="flex items-center gap-2 mb-3"><span className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center"><BookOpen size={16} /></span><Link href={`/help/${c.slug}`} className="font-semibold hover:text-primary">{c.name}</Link></div>
                <ul className="space-y-1.5 text-sm">
                  {c.articles.slice(0, 5).map((a) => <li key={a.id}><Link href={`/help/${c.slug}/${a.slug}`} className="text-muted hover:text-fg">{a.title}</Link></li>)}
                </ul>
                {c.articles.length > 5 && <Link href={`/help/${c.slug}`} className="text-xs text-primary mt-3 inline-block">View all {c.articles.length} articles</Link>}
              </div>
            ))}
          </div>
          {popular.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold mb-4">Popular articles</h2>
              <ul className="card divide-y divide-border">
                {popular.map((a) => <li key={a.id} className="p-4 flex justify-between gap-3"><Link href={`/help/${a.category?.slug ?? "general"}/${a.slug}`} className="font-medium hover:text-primary">{a.title}</Link><span className="text-xs text-muted whitespace-nowrap">{a.views} views</span></li>)}
              </ul>
            </section>
          )}
        </>
      )}
      <p className="text-center text-sm text-muted mt-12">Still need help? <Link href="/contact" className="text-primary">Contact support</Link>.</p>
    </div>
  );
}
