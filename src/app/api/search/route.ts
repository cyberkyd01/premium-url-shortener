import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { shortUrl } from "@/lib/links";
import { truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export interface SearchHit { id: string; type: "link" | "bio" | "qr" | "campaign" | "channel"; title: string; subtitle?: string; href: string; short?: string; tags?: string[] }

/** GET /api/search?q= — session auth, scoped to the workspace owner. Searches links (alias/title/url/tags), bio pages, QR codes, campaigns and channels. */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return NextResponse.json({ error: true, message: "Unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ results: [] as SearchHit[] });
  const s = await getSettings();
  const owner = ws.ownerId;
  const take = 6;
  const [links, bios, qrs, campaigns, channels] = await Promise.all([
    db.link.findMany({ where: { userId: owner, OR: [{ alias: { contains: q } }, { title: { contains: q } }, { url: { contains: q } }, { tags: { contains: q } }] }, orderBy: [{ isPinned: "desc" }, { clicks: "desc" }], take: take + 2, include: { domain: true } }),
    s["bio.enabled"] === "1" ? db.bioPage.findMany({ where: { userId: owner, OR: [{ alias: { contains: q } }, { name: { contains: q } }] }, take, select: { id: true, alias: true, name: true } }) : Promise.resolve([]),
    s["qr.enabled"] === "1" ? db.qrCode.findMany({ where: { userId: owner, OR: [{ name: { contains: q } }, { data: { contains: q } }] }, take, select: { id: true, name: true, type: true } }) : Promise.resolve([]),
    db.campaign.findMany({ where: { userId: owner, OR: [{ name: { contains: q } }, { slug: { contains: q } }] }, take, select: { id: true, name: true, slug: true } }),
    db.channel.findMany({ where: { userId: owner, name: { contains: q } }, take, select: { id: true, name: true, color: true } }),
  ]);
  const results: SearchHit[] = [
    ...links.map((l): SearchHit => ({ id: l.id, type: "link", title: l.title ? `${l.title} · /${l.alias}` : `/${l.alias}`, subtitle: truncate(l.url, 70), href: `/dashboard/links/${l.id}`, short: shortUrl(l), tags: l.tags ? l.tags.split(",").map((t) => t.trim()).filter(Boolean) : [] })),
    ...bios.map((b): SearchHit => ({ id: b.id, type: "bio", title: b.name || b.alias, subtitle: `/${b.alias}`, href: `/dashboard/bio/${b.id}` })),
    ...qrs.map((x): SearchHit => ({ id: x.id, type: "qr", title: x.name, subtitle: x.type, href: `/dashboard/qr/${x.id}` })),
    ...campaigns.map((c): SearchHit => ({ id: c.id, type: "campaign", title: c.name, subtitle: c.slug, href: `/dashboard/campaigns/${c.id}` })),
    ...channels.map((c): SearchHit => ({ id: c.id, type: "channel", title: c.name, href: `/dashboard/links?channel=${c.id}` })),
  ];
  return NextResponse.json({ results });
}
