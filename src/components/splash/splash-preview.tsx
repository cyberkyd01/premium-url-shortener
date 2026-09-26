"use client";
import { useEffect, useRef, useState } from "react";

/** The subset of SplashPage fields needed to render the page (matches the Prisma model). */
export interface SplashData {
  title?: string | null;
  description?: string | null;
  logo?: string | null;
  image?: string | null;
  buttonText?: string | null;
  buttonColor?: string | null;
  bgColor?: string | null;
  textColor?: string | null;
  countdown?: number | null;
  showAds?: boolean | null;
  adCode?: string | null;
  customCss?: string | null;
  customHtml?: string | null;
}

/** Re-creates <script> tags inside a container so injected ad/HTML code executes. */
function RawHtml({ html, className, execute }: { html: string; className?: string; execute: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!execute || !ref.current) return;
    ref.current.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });
  }, [html, execute]);
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Renders a custom splash page exactly as visitors see it. Used by the dashboard live preview
 * (`preview`) and by the redirect engine (`/{alias}` with redirectType "custom").
 * - `countdown` overrides `splash.countdown` (seconds before the button becomes active).
 * - `autoRedirect` navigates to `targetUrl` when the countdown ends.
 * - `adsTop` / `adsBottom` are admin ad slots (settings ads.splashTop / ads.splashBottom).
 */
export function SplashView({ splash, targetUrl, countdown, preview = false, autoRedirect = false, adsTop, adsBottom, branding }: { splash: SplashData; targetUrl: string; countdown?: number; preview?: boolean; autoRedirect?: boolean; adsTop?: string | null; adsBottom?: string | null; branding?: React.ReactNode }) {
  const total = Math.max(0, countdown ?? splash.countdown ?? 5);
  const [left, setLeft] = useState(total);
  useEffect(() => { setLeft(total); }, [total, preview]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => {
    if (!preview && autoRedirect && left <= 0 && targetUrl) window.location.href = targetUrl;
  }, [left, preview, autoRedirect, targetUrl]);
  const ready = left <= 0;
  const bg = splash.bgColor || "#ffffff";
  const fg = splash.textColor || "#111827";
  const btn = splash.buttonColor || "#6366f1";
  const host = (() => { try { return new URL(targetUrl).host; } catch { return targetUrl; } })();
  return (
    <div className="splash-page min-h-full w-full flex flex-col" style={{ background: bg, color: fg, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {splash.customCss && <style dangerouslySetInnerHTML={{ __html: splash.customCss }} />}
      {adsTop && <RawHtml html={adsTop} className="splash-ad splash-ad-top flex justify-center p-3" execute={!preview} />}
      {splash.showAds && splash.adCode && <RawHtml html={splash.adCode} className="splash-ad splash-ad-custom flex justify-center p-3" execute={!preview} />}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="splash-card w-full max-w-lg text-center">
          {splash.logo && <img src={splash.logo} alt="" className="splash-logo mx-auto h-16 max-w-[220px] object-contain mb-6" />}
          {splash.title && <h1 className="splash-title text-2xl md:text-3xl font-bold mb-3">{splash.title}</h1>}
          {splash.description && <p className="splash-description text-base opacity-80 mb-6 whitespace-pre-line">{splash.description}</p>}
          {splash.image && <img src={splash.image} alt="" className="splash-image mx-auto max-h-72 w-auto rounded-xl mb-6 object-contain" />}
          {splash.customHtml && <RawHtml html={splash.customHtml} className="splash-html mb-6 text-left" execute={!preview} />}
          <p className="splash-destination text-xs opacity-60 mb-4 break-all">You are being redirected to <span className="font-medium">{host}</span></p>
          {ready ? (
            <a href={preview ? undefined : targetUrl} onClick={(e) => { if (preview) e.preventDefault(); }} rel="nofollow noopener" className="splash-button inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: btn }}>{splash.buttonText || "Continue"}</a>
          ) : (
            <button type="button" disabled className="splash-button splash-button-waiting inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white opacity-60 cursor-wait" style={{ background: btn }}>{splash.buttonText || "Continue"} ({left})</button>
          )}
        </div>
      </div>
      {adsBottom && <RawHtml html={adsBottom} className="splash-ad splash-ad-bottom flex justify-center p-3" execute={!preview} />}
      {branding && <div className="splash-branding text-center text-xs opacity-60 p-4">{branding}</div>}
    </div>
  );
}
