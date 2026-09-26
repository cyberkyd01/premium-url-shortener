import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseVisitor } from "@/lib/geo";
import { resolveLink, recordClick } from "@/lib/redirect";
import { resolveHost } from "@/lib/resolve-host";
import { shortUrl } from "@/lib/links";
import { pickRotatorIndex } from "@/lib/rotator";
import { rotatorCookieName } from "@/lib/link-cookies";
import { appUrl } from "@/lib/utils";
import { noindexEnabled } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Direct redirect endpoint (no interstitials) for API consumers, plus the cookie-based sequential campaign rotator. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  const ctx = await resolveHost(req.headers.get("host"));
  if (ctx.unknown) return NextResponse.redirect(appUrl("/" + encodeURIComponent(alias)), 302);
  const visitor = parseVisitor(req.headers);

  const link = await db.link.findFirst({ where: { alias, domainId: ctx.domainId } });
  if (link) {
    const res = await resolveLink(link, visitor, req.nextUrl.searchParams);
    if (res.kind === "redirect" || res.kind === "interstitial") {
      await recordClick(link, visitor, res.url, req.nextUrl.searchParams);
      const out = NextResponse.redirect(res.url, 302);
      if (await noindexEnabled()) out.headers.set("X-Robots-Tag", "noindex, nofollow"); // "Block Search Engines" add-on
      return out;
    }
    if ((res.kind === "expired" || res.kind === "limit") && res.url) return NextResponse.redirect(res.url, 302);
    if (res.kind === "blocked" || res.kind === "disabled") return NextResponse.json({ error: 1, message: "Link unavailable" }, { status: 404 });
    // password / pending / expired without fallback: hand over to the full page
    return NextResponse.redirect(new URL("/" + encodeURIComponent(alias), req.nextUrl.origin), 302);
  }

  const campaign = await db.campaign.findFirst({ where: { rotatorAlias: alias, isRotator: true } });
  if (campaign) {
    const links = await db.link.findMany({ where: { campaignId: campaign.id, status: "active", isArchived: false }, include: { domain: true }, orderBy: { createdAt: "asc" } });
    if (!links.length) return NextResponse.json({ error: 1, message: "Campaign has no links" }, { status: 404 });
    const name = rotatorCookieName(campaign.id);
    const counter = parseInt(req.cookies.get(name)?.value ?? "0", 10) || 0;
    const idx = Math.max(0, pickRotatorIndex(campaign.rotatorMode, links, counter));
    const res = NextResponse.redirect(shortUrl(links[idx]), 302);
    res.cookies.set(name, String(counter + 1), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
    return res;
  }

  return NextResponse.json({ error: 1, message: "Not found" }, { status: 404 });
}
