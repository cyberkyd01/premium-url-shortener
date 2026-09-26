import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseVisitor } from "@/lib/geo";
import { resolveHost } from "@/lib/resolve-host";
import { recordBioView, recordQrScan } from "@/lib/redirect";
import { shortUrl } from "@/lib/links";
import { pickRotatorIndex } from "@/lib/rotator";
import { pwCookieName, pwToken, rotatorCookieName } from "@/lib/link-cookies";
import { captchaClientConfig } from "@/lib/captcha";
import { DomainWorkingPage } from "@/components/redirect/status-pages";
import { DownloadPage } from "@/components/redirect/download-page";
import { QrContentPage } from "@/components/redirect/qr-content";
import { PublicShell } from "@/components/layout/public-shell";
import { BioRenderer } from "@/components/bio/bio-renderer";
import { renderLink } from "./render-link";
import { unlockFile, downloadFile } from "./actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ alias: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** Root resolver: short link → bio page → dynamic QR → campaign rotator → hosted file → CMS page → 404. */
export default async function AliasPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { alias: raw } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) { if (Array.isArray(v)) v.forEach((x) => query.append(k, x)); else if (v !== undefined) query.set(k, v); }
  let alias = "";
  try { alias = decodeURIComponent(raw); } catch { alias = raw; }
  if (alias.endsWith("+")) redirect(`/stats/${encodeURIComponent(alias.slice(0, -1))}`);

  const h = await headers();
  const s = await getSettings();
  const ctx = await resolveHost(h.get("host"));
  if (ctx.unknown) return <DomainWorkingPage host={ctx.host} siteName={s["site.name"]} logo={s["site.logo"] || undefined} />;
  if (!alias && ctx.domain?.rootRedirect) redirect(ctx.domain.rootRedirect);
  const visitor = parseVisitor(h);
  const cookieStore = await cookies();

  // a/b. Short link
  const link = await db.link.findFirst({ where: { alias, domainId: ctx.domainId }, include: { domain: true, pixels: { include: { pixel: true } }, splash: true, overlay: true } });
  if (link) return renderLink(link, visitor, query, cookieStore, s);

  // c. Bio page
  if (s["bio.enabled"] === "1") {
    const bio = await db.bioPage.findFirst({ where: { alias, domainId: ctx.domainId, status: "active" }, include: { blocks: { where: { enabled: true }, orderBy: { order: "asc" } } } });
    if (bio) {
      await recordBioView(bio.id, visitor);
      const { blocks, ...page } = bio;
      return <BioRenderer page={page} blocks={blocks} visitor={{ countryCode: visitor.countryCode, language: visitor.language }} />;
    }
  }

  // d. Dynamic QR code
  if (s["qr.enabled"] === "1") {
    const qr = await db.qrCode.findUnique({ where: { alias }, include: { link: { include: { domain: true } }, bioPage: true } });
    if (qr) {
      await recordQrScan(qr.id, visitor);
      if (qr.type === "link" && qr.link) redirect(shortUrl(qr.link));
      if (qr.type === "bio" && qr.bioPage) redirect(`/${qr.bioPage.alias}`);
      if (qr.type === "url" && /^(https?:|mailto:|tel:|sms:)/i.test(qr.data)) redirect(qr.data);
      return <QrContentPage qr={qr} siteName={s["site.name"]} logo={s["site.logo"] || undefined} />;
    }
  }

  // e. Campaign rotator or public campaign page
  const campaign = await db.campaign.findFirst({ where: { OR: [{ rotatorAlias: alias, isRotator: true }, { slug: alias, isPublic: true }] } });
  if (campaign) {
    if (campaign.isRotator && campaign.rotatorAlias === alias) {
      const links = await db.link.findMany({ where: { campaignId: campaign.id, status: "active", isArchived: false }, include: { domain: true }, orderBy: { createdAt: "asc" } });
      if (!links.length) notFound();
      if (campaign.rotatorMode === "sequential") redirect(`/go/${encodeURIComponent(alias)}`); // route handler keeps the cookie counter
      const counter = parseInt(cookieStore.get(rotatorCookieName(campaign.id))?.value ?? "0", 10) || 0;
      const idx = pickRotatorIndex(campaign.rotatorMode, links, counter);
      redirect(shortUrl(links[Math.max(0, idx)]));
    }
    if (campaign.isPublic) redirect(`/campaign/${campaign.slug}`);
  }

  // f. Hosted file
  const file = await db.hostedFile.findUnique({ where: { alias } });
  if (file && (!file.domainId || file.domainId === ctx.domainId)) {
    const expired = !!file.expiresAt && file.expiresAt < new Date();
    const locked = !!file.password && cookieStore.get(pwCookieName("file", file.id))?.value !== pwToken("file", file.id);
    const cfg = await captchaClientConfig();
    return <DownloadPage file={file} siteName={s["site.name"]} logo={s["site.logo"] || undefined} locked={locked} expired={expired} unlockAction={unlockFile} downloadAction={downloadFile} captcha={cfg.on.password && cfg.provider !== "none" ? { provider: cfg.provider, siteKey: cfg.siteKey } : null} />;
  }

  // Custom domain without a match: owner's fallback URL
  if (ctx.domain?.notFoundRedirect) redirect(ctx.domain.notFoundRedirect);

  // g. CMS page (main host only)
  if (ctx.isMain) {
    const lang = cookieStore.get("lang")?.value || s["site.defaultLanguage"] || "en";
    const page = await db.page.findFirst({ where: { slug: alias, published: true, language: { in: ["all", lang, s["site.defaultLanguage"] || "en"] } } });
    if (page) {
      return (
        <PublicShell>
          <title>{page.seoTitle || page.title}</title>
          {page.seoDescription && <meta name="description" content={page.seoDescription} />}
          <article className="max-w-3xl mx-auto px-4 py-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-6">{page.title}</h1>
            <div className="prose-content" dangerouslySetInnerHTML={{ __html: page.content }} />
          </article>
        </PublicShell>
      );
    }
  }

  notFound();
}
