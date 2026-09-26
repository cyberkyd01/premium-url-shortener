import type { Domain, Link, Overlay, Pixel, SplashPage as SplashModel } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { db } from "@/lib/db";
import { resolveLink, recordClick } from "@/lib/redirect";
import { after } from "next/server";
import { checkTrafficAlert } from "@/lib/alerts";
import type { VisitorInfo } from "@/lib/geo";
import { parseLinkJson, shortUrl } from "@/lib/links";
import { getUserPlan } from "@/lib/plan";
import { detectDeepLink } from "@/lib/deeplinks";
import { pixelsHtml, gaHtml } from "@/lib/pixels";
import { pwCookieName, pwToken } from "@/lib/link-cookies";
import { captchaClientConfig } from "@/lib/captcha";
import { json } from "@/lib/utils";
import { LinkStatusPage, MetaRedirectPage } from "@/components/redirect/status-pages";
import { PasswordForm } from "@/components/redirect/password-form";
import { InterstitialShell, MetaTags } from "@/components/redirect/shell";
import { FramePage } from "@/components/redirect/frame-page";
import { SplashPage } from "@/components/redirect/splash-page";
import { CustomSplashPage } from "@/components/redirect/custom-splash";
import { OverlayPage, type OverlayConfig } from "@/components/redirect/overlay-widget";
import { DeepLinkPage } from "@/components/redirect/deeplink-page";
import { BreakoutPage } from "@/components/redirect/breakout-page";
import { CloakPage } from "@/components/redirect/cloak-page";
import { noindexEnabled } from "@/lib/security";
import { unlockLink } from "./actions";

export type FullLink = Link & { domain: Domain | null; pixels: { pixel: Pixel }[]; splash: SplashModel | null; overlay: Overlay | null };

async function adFor(slot: "frame" | "splashTop" | "splashBottom", s: Record<string, string>, noAds: boolean) {
  if (s["ads.enabled"] !== "1") return "";
  if (noAds && s["ads.hideForPremium"] === "1") return "";
  if (slot === "frame" && s["frame.ads"] !== "1") return "";
  if (slot !== "frame" && s["splash.ads"] !== "1") return "";
  const dbSlot = slot === "frame" ? "frame" : slot === "splashTop" ? "splash-top" : "splash-bottom";
  const rows = await db.ad.findMany({ where: { slot: dbSlot, active: true } });
  return [s["ads." + slot] || "", ...rows.map((r) => r.code)].filter(Boolean).join("\n");
}

function isScheme(v?: string | null) { return !!v && !/^https?:\/\//i.test(v); }

/** Resolves and renders a short link for the current visitor. */
export async function renderLink(link: FullLink, visitor: VisitorInfo, query: URLSearchParams, cookieStore: ReadonlyRequestCookies, s: Record<string, string>) {
  const page = await renderLinkPage(link, visitor, query, cookieStore, s);
  // "Block Search Engines" add-on: hoisted robots meta on every short-link HTML page (interstitials, password, expired…).
  if (await noindexEnabled()) return <><meta name="robots" content="noindex, nofollow" /><meta name="googlebot" content="noindex, nofollow" />{page}</>;
  return page;
}

async function renderLinkPage(link: FullLink, visitor: VisitorInfo, query: URLSearchParams, cookieStore: ReadonlyRequestCookies, s: Record<string, string>) {
  const siteName = s["site.name"];
  const logo = s["site.logo"] || undefined;
  const passwordOk = !!link.password && cookieStore.get(pwCookieName("link", link.id))?.value === pwToken("link", link.id);
  const res = await resolveLink(link, visitor, query, { passwordOk });
  const features = link.userId ? (await getUserPlan(link.userId)).features : null;
  const noBranding = !!features?.noBranding;
  const noAds = !!features?.noAds;
  const pixels = pixelsHtml(link.pixels.map((p) => p.pixel));
  const ga = s["links.trackingMethod"] === "ga" ? gaHtml(s["links.gaId"] || "") : "";
  const tracking = [pixels, ga].filter(Boolean).join("\n");
  const meta = { title: link.title, description: link.description, image: link.image };
  const short = shortUrl(link);
  const delay = Math.max(0, parseInt(s["links.redirectDelay"] || "2", 10) || 0);

  switch (res.kind) {
    case "pending": return <LinkStatusPage kind="pending" siteName={siteName} logo={logo} noBranding={noBranding} />;
    case "scheduled":
      return (
        <InterstitialShell meta={{ title: "Coming soon", url: short }} siteName={siteName} logo={logo} noBranding={noBranding}>
          <div className="card max-w-md w-full p-8 text-center">
            <h1 className="text-2xl font-bold">This link is not live yet</h1>
            <p className="text-muted mt-2">It will be available from {res.activateAt.toUTCString()}.</p>
          </div>
        </InterstitialShell>
      );
    case "disabled":
    case "blocked": notFound();
    // eslint-disable-next-line no-fallthrough
    case "expired": if (res.url) redirect(res.url); return <LinkStatusPage kind="expired" siteName={siteName} logo={logo} noBranding={noBranding} />;
    case "limit": if (res.url) redirect(res.url); return <LinkStatusPage kind="limit" siteName={siteName} logo={logo} noBranding={noBranding} />;
    case "password": {
      const cfg = await captchaClientConfig();
      return (
        <InterstitialShell meta={{ ...meta, url: short }} siteName={siteName} logo={logo} noBranding={noBranding}>
          <PasswordForm action={unlockLink} id={link.id} title={link.title} captcha={cfg.on.password && cfg.provider !== "none" ? { provider: cfg.provider, siteKey: cfg.siteKey } : null} />
        </InterstitialShell>
      );
    }
    case "redirect": {
      // Crawlers get the custom meta tags page without being redirected so social previews use the link's own image/title.
      if (visitor.isBot && link.image) return <MetaRedirectPage url={res.url} meta={meta} siteName={siteName} logo={logo} pixels="" delay={0} redirectNow={false} noBranding={noBranding} />;
      await recordClick(link, visitor, res.url, query);
      after(() => checkTrafficAlert(link.id).catch(() => {})); // premium: threshold + spike alerts
      if (tracking) return <MetaRedirectPage url={res.url} meta={meta} siteName={siteName} logo={logo} pixels={tracking} delay={delay} redirectNow noBranding={noBranding} />;
      redirect(res.url);
    }
    // eslint-disable-next-line no-fallthrough
    case "interstitial": {
      await recordClick(link, visitor, res.url, query);
      after(() => checkTrafficAlert(link.id).catch(() => {})); // premium: threshold + spike alerts
      const url = res.url;
      switch (res.type) {
        case "frame":
          return <FramePage url={url} shortUrl={short} meta={meta} siteName={siteName} logo={logo} pixels={tracking} ad={await adFor("frame", s, noAds)} noBranding={noBranding} />;
        case "custom":
          if (link.splash) return <CustomSplashPage splash={link.splash} url={url} shortUrl={short} meta={meta} siteName={siteName} pixels={tracking} noBranding={noBranding} />;
        // eslint-disable-next-line no-fallthrough
        case "splash":
          return <SplashPage url={url} shortUrl={short} alias={link.alias} meta={meta} siteName={siteName} logo={logo} pixels={tracking} countdown={parseInt(s["splash.countdown"] || "5", 10) || 0} adTop={await adFor("splashTop", s, noAds)} adBottom={await adFor("splashBottom", s, noAds)} noBranding={noBranding} />;
        case "overlay": {
          if (!link.overlay) redirect(url);
          const o = link.overlay;
          const cfg: OverlayConfig = { id: o.id, type: o.type, position: o.position, title: o.title, message: o.message, buttonText: o.buttonText, buttonUrl: o.buttonUrl, image: o.image, video: o.video, bgColor: o.bgColor, textColor: o.textColor, accentColor: o.accentColor, delay: o.delay, disclaimer: o.disclaimer, options: json<OverlayConfig["options"]>(o.options, {}) };
          return (
            <InterstitialShell meta={{ ...meta, url: short }} siteName={siteName} logo={logo} pixels={tracking} noBranding={noBranding} fullscreen>
              <OverlayPage url={url} overlay={cfg} siteName={siteName} noBranding={noBranding} />
            </InterstitialShell>
          );
        }
        case "deeplink": {
          const cfg = parseLinkJson(link).deepLinkConfig;
          const auto = cfg.auto === false ? null : detectDeepLink(url);
          const ios = cfg.scheme || (isScheme(cfg.ios) ? cfg.ios! : auto?.ios) || null;
          const android = cfg.scheme || (isScheme(cfg.android) ? cfg.android! : auto?.android) || null;
          return (
            <InterstitialShell meta={{ ...meta, url: short }} siteName={siteName} logo={logo} pixels={tracking} noBranding={noBranding} fullscreen>
              <DeepLinkPage url={cfg.fallback || url} ios={ios} android={android} iosStore={!isScheme(cfg.ios) ? cfg.ios ?? null : null} androidStore={!isScheme(cfg.android) ? cfg.android ?? null : null} app={auto?.app ?? null} os={visitor.os} siteName={siteName} noBranding={noBranding} />
            </InterstitialShell>
          );
        }
        case "breakout":
          return (
            <InterstitialShell meta={{ ...meta, url: short }} siteName={siteName} logo={logo} pixels={tracking} noBranding={noBranding} fullscreen>
              <BreakoutPage url={url} os={visitor.os} inApp={visitor.inApp} siteName={siteName} noBranding={noBranding} />
            </InterstitialShell>
          );
        case "cloak":
          return <><MetaTags meta={meta} siteName={siteName} /><CloakPage url={url} title={link.title} pixels={tracking} /></>;
      }
    }
  }
  notFound();
}
