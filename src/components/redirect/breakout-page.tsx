"use client";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MoreVertical, Share } from "lucide-react";

/** Escapes in-app browsers (Instagram, Facebook, TikTok…) into the system browser. */
export function BreakoutPage({ url, os, inApp, siteName, noBranding }: { url: string; os: string | null; inApp: string | null; siteName: string; noBranding?: boolean }) {
  const isIos = /ios/i.test(os ?? "");
  const isAndroid = /android/i.test(os ?? "");
  const [copied, setCopied] = useState(false);
  const breakout = useMemo(() => {
    try {
      const u = new URL(url);
      if (isAndroid) return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
      if (isIos) return url.replace(/^https:\/\//, "x-safari-https://").replace(/^http:\/\//, "x-safari-http://");
    } catch { /* ignore */ }
    return url;
  }, [url, isAndroid, isIos]);
  useEffect(() => {
    const t = setTimeout(() => { window.location.href = breakout; }, 300);
    return () => clearTimeout(t);
  }, [breakout]);
  const appName = inApp ? inApp.charAt(0).toUpperCase() + inApp.slice(1) : "this app";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="card max-w-sm w-full p-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center mb-4"><ExternalLink size={22} /></div>
        <h1 className="text-xl font-bold">Open in your browser</h1>
        <p className="text-sm text-muted mt-2">You are viewing this page inside {appName}. For the best experience, open the link in your default browser.</p>
        <ol className="text-left text-sm mt-4 space-y-2 text-muted">
          <li className="flex gap-2"><span className="font-semibold text-fg">1.</span> Tap the {isIos ? <><Share size={14} className="inline" /> share icon</> : <><MoreVertical size={14} className="inline" /> menu icon</>} in the corner.</li>
          <li className="flex gap-2"><span className="font-semibold text-fg">2.</span> Choose “Open in {isIos ? "Safari" : "Chrome"}” or “Open in browser”.</li>
        </ol>
        <div className="mt-5 space-y-2">
          <a href={breakout} className="btn-primary w-full">Open in browser</a>
          <button type="button" className="btn-secondary w-full" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>{copied ? "Link copied" : "Copy link"}</button>
          <a href={url} className="btn-ghost w-full" rel="noreferrer">Continue here anyway</a>
        </div>
      </div>
      {!noBranding && <p className="mt-6 text-xs text-muted">Powered by {siteName}</p>}
    </div>
  );
}
