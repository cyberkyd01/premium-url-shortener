import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { appUrl, formatDate } from "@/lib/utils";
import { Breadcrumbs } from "@/components/public/section";
import { HelpfulButton } from "@/components/public/helpful-button";

type Props = { params: Promise<{ category: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const a = await db.helpArticle.findFirst({ where: { slug, published: true }, select: { title: true, content: true } });
  if (!a) return { title: "Article not found" };
  const text = a.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return { title: `${a.title} · Help Center`, description: text, alternates: { canonical: appUrl(`/help/${category}/${slug}`) } };
}

export default async function HelpArticlePage({ params }: Props) {
  const { category, slug } = await params;
  const s = await getSettings();
  if (s["help.enabled"] !== "1") notFound();
  const article = await db.helpArticle.findFirst({ where: { slug, published: true }, include: { category: { include: { articles: { where: { published: true }, orderBy: { order: "asc" }, select: { id: true, title: true, slug: true } } } } } });
  if (!article) notFound();
  db.helpArticle.update({ where: { id: article.id }, data: { views: { increment: 1 } } }).catch(() => undefined);
  const cat = article.category;
  const siblings = cat?.articles.filter((a) => a.id !== article.id) ?? [];
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 grid gap-10 lg:grid-cols-[1fr_240px]">
      <article>
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/help", label: "Help Center" }, ...(cat ? [{ href: `/help/${cat.slug}`, label: cat.name }] : []), { label: article.title }]} />
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <p className="text-xs text-muted mt-2">Updated {formatDate(article.updatedAt)} · {article.views + 1} views</p>
        <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: article.content }} />
        <HelpfulButton articleId={article.id} count={article.helpful} />
        <p className="text-sm text-muted mt-6">Still stuck? <Link href="/contact" className="text-primary">Contact support</Link>.</p>
      </article>
      {cat && siblings.length > 0 && (
        <aside className="card p-4 h-fit">
          <p className="font-semibold text-sm mb-3">More in {cat.name}</p>
          <ul className="space-y-1.5 text-sm">{siblings.map((a) => <li key={a.id}><Link href={`/help/${cat.slug}/${a.slug}`} className="text-muted hover:text-fg">{a.title}</Link></li>)}</ul>
        </aside>
      )}
    </div>
  );
}
