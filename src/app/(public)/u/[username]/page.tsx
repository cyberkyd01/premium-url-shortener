import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseVisitor } from "@/lib/geo";
import { recordBioView } from "@/lib/redirect";
import { appUrl } from "@/lib/utils";
import { parseBioJson } from "@/lib/bio-widgets";
import { BioRenderer } from "@/components/bio/bio-renderer";

export const dynamic = "force-dynamic";

async function load(username: string) {
  const user = await db.user.findUnique({ where: { username }, select: { id: true, verified: true, status: true } });
  if (!user || user.status !== 1) return null;
  const page = await db.bioPage.findFirst({ where: { userId: user.id, isDefault: true, isTemplate: false, status: "active" }, include: { blocks: { orderBy: { order: "asc" } } } });
  if (!page) return null;
  return { user, page };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const data = await load(username);
  if (!data) return { title: "Not found" };
  const s = await getSettings();
  const seo = parseBioJson(data.page).seo;
  const title = seo.title || data.page.name || username;
  return { title: `${title} | ${s["site.name"]}`, description: seo.description || data.page.bio || undefined, robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description: seo.description || data.page.bio || undefined, images: seo.image || data.page.avatar ? [seo.image || data.page.avatar!] : undefined, url: appUrl(`/u/${username}`) } };
}

/** Public profile: renders the user's default bio page. */
export default async function UserBioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const s = await getSettings();
  if (s["bio.enabled"] !== "1" || s["bio.publicProfiles"] === "0") notFound();
  const data = await load(username);
  if (!data) notFound();
  const { page, user } = data;
  const visitor = parseVisitor(await headers());
  if (!visitor.isBot) recordBioView(page.id, visitor).catch(() => {});
  const { blocks, ...rest } = page;
  return <BioRenderer page={{ ...rest, verified: rest.verified || user.verified }} blocks={blocks} visitor={{ countryCode: visitor.countryCode, language: visitor.language }} />;
}
