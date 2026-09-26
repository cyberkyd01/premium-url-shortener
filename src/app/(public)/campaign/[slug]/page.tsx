import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BioBlock } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { shortUrl } from "@/lib/links";
import { BioRenderer } from "@/components/bio/bio-renderer";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const campaign = await db.campaign.findUnique({ where: { slug }, include: { user: { select: { id: true, isPublic: true, status: true, verified: true, username: true, name: true } }, links: { where: { status: "active", isArchived: false }, include: { domain: true }, orderBy: { createdAt: "desc" } } } });
  if (!campaign || !campaign.isPublic || !campaign.user.isPublic || campaign.user.status !== 1) return null;
  const page = await db.bioPage.findFirst({ where: { userId: campaign.user.id, isDefault: true, isTemplate: false, status: "active" } });
  if (!page) return null;
  return { campaign, page };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };
  const s = await getSettings();
  return { title: `${data.campaign.name} | ${s["site.name"]}`, description: data.campaign.description ?? undefined };
}

/** Public campaign list: the owner's default bio page appearance listing the campaign's links as buttons. */
export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { campaign, page } = data;
  const now = new Date();
  const blocks: BioBlock[] = campaign.links.map((l, i) => ({
    id: "campaign-" + l.id, bioPageId: page.id, type: "link", title: l.title || l.url, url: shortUrl(l), content: "{}", thumbnail: l.image, order: i, clicks: 0, enabled: true,
    scheduleStart: null, scheduleEnd: null, countries: "[]", languages: "[]", sensitive: false, gated: null, animation: null, createdAt: now,
  }));
  const heading: BioBlock = { id: "campaign-heading", bioPageId: page.id, type: "heading", title: campaign.name, url: null, content: JSON.stringify({ size: "md" }), thumbnail: null, order: -2, clicks: 0, enabled: true, scheduleStart: null, scheduleEnd: null, countries: "[]", languages: "[]", sensitive: false, gated: null, animation: null, createdAt: now };
  const desc: BioBlock[] = campaign.description ? [{ ...heading, id: "campaign-desc", type: "text", title: null, content: JSON.stringify({ text: campaign.description }), order: -1 }] : [];
  // Campaign pages never apply the page's access gates or pixels; only its appearance is reused.
  const view = { ...page, password: null, ageGate: null, sensitive: false, nsfwWarning: false, newsletterGate: false, pixelsJson: "[]" };
  return <BioRenderer page={view} blocks={[heading, ...desc, ...blocks]} preview />;
}
