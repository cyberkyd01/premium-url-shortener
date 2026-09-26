import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/public/section";

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await db.helpCategory.findUnique({ where: { slug: category } });
  return { title: cat ? `${cat.name} · Help Center` : "Help Center" };
}

export default async function HelpCategoryPage({ params }: Props) {
  const { category } = await params;
  const s = await getSettings();
  if (s["help.enabled"] !== "1") notFound();
  const cat = await db.helpCategory.findUnique({ where: { slug: category }, include: { articles: { where: { published: true }, orderBy: { order: "asc" } } } });
  if (!cat) notFound();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/help", label: "Help Center" }, { label: cat.name }]} />
      <h1 className="text-3xl font-bold mb-6">{cat.name}</h1>
      {cat.articles.length ? (
        <ul className="card divide-y divide-border">
          {cat.articles.map((a) => (
            <li key={a.id} className="p-4">
              <Link href={`/help/${cat.slug}/${a.slug}`} className="font-medium hover:text-primary">{a.title}</Link>
              <p className="text-xs text-muted mt-1">{a.views} views · {a.helpful} found this helpful</p>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No articles in this category yet.</p>}
    </div>
  );
}
