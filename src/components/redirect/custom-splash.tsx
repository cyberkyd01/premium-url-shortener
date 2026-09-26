import type { SplashPage as SplashModel } from "@prisma/client";
import { InterstitialShell, RawHtml, type LinkMeta } from "./shell";
import { CountdownButton } from "./countdown-button";
import { escapeHtml } from "@/lib/utils";

/** Renders a user-designed SplashPage model (logo, image, colors, custom HTML/CSS, countdown). */
export function CustomSplashPage({ splash, url, shortUrl, meta, siteName, pixels, noBranding }: {
  splash: SplashModel; url: string; shortUrl: string; meta: LinkMeta; siteName: string; pixels: string; noBranding?: boolean;
}) {
  const title = splash.title || meta.title || "";
  const description = splash.description || meta.description || "";
  const html = (splash.customHtml ?? "").replace(/\{\{\s*url\s*\}\}/g, escapeHtml(url)).replace(/\{\{\s*title\s*\}\}/g, escapeHtml(title));
  return (
    <InterstitialShell meta={{ title, description, image: splash.image || meta.image, url: shortUrl }} siteName={siteName} pixels={pixels} noBranding={noBranding} fullscreen>
      {splash.customCss && <style dangerouslySetInnerHTML={{ __html: splash.customCss }} />}
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: splash.bgColor, color: splash.textColor }}>
        <div className="w-full max-w-lg text-center splash-container">
          {splash.logo && <img src={splash.logo} alt="" className="h-12 mx-auto mb-6 splash-logo" />}
          {splash.showAds && splash.adCode && <RawHtml html={splash.adCode} className="mb-4 splash-ad" />}
          {splash.image && <img src={splash.image} alt="" className="w-full max-h-72 object-cover rounded-xl mb-5 splash-image" />}
          {title && <h1 className="text-2xl font-bold splash-title">{title}</h1>}
          {description && <p className="mt-2 opacity-80 splash-description">{description}</p>}
          {html && <div className="mt-4 splash-html" dangerouslySetInnerHTML={{ __html: html }} />}
          <div className="mt-6 splash-button"><CountdownButton url={url} seconds={splash.countdown} label={splash.buttonText || "Continue"} color={splash.buttonColor} textColor="#ffffff" /></div>
          {!noBranding && <p className="mt-8 text-xs opacity-60">Powered by {siteName}</p>}
        </div>
      </div>
    </InterstitialShell>
  );
}
