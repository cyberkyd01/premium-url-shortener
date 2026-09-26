"use client";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

export interface DeepLinkProps { url: string; ios: string | null; android: string | null; iosStore: string | null; androidStore: string | null; app: string | null; os: string | null; siteName: string; noBranding?: boolean }

/** Tries to open the native app via its URL scheme; falls back to the store link or the web URL after a short timeout. */
export function DeepLinkPage({ url, ios, android, iosStore, androidStore, app, os, siteName, noBranding }: DeepLinkProps) {
  const [status, setStatus] = useState<"trying" | "fallback">("trying");
  const isIos = /ios/i.test(os ?? "") || (typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent));
  const scheme = isIos ? ios : android;
  const store = isIos ? iosStore : androidStore;
  const fallback = store || url;
  useEffect(() => {
    if (!scheme) { window.location.replace(fallback); return; }
    const start = Date.now();
    let hidden = false;
    const onVis = () => { if (document.hidden) hidden = true; };
    document.addEventListener("visibilitychange", onVis);
    window.location.href = scheme;
    const t = setTimeout(() => {
      document.removeEventListener("visibilitychange", onVis);
      if (hidden || Date.now() - start > 4000) return; // app opened
      setStatus("fallback");
      window.location.replace(fallback);
    }, 2500);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, [scheme, fallback]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="card max-w-sm w-full p-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center mb-4"><Smartphone size={22} /></div>
        <h1 className="text-xl font-bold">{status === "trying" ? `Opening ${app ? app.charAt(0).toUpperCase() + app.slice(1) : "the app"}…` : "Redirecting…"}</h1>
        <p className="text-sm text-muted mt-2">If nothing happens, use one of the options below.</p>
        <div className="mt-5 space-y-2">
          {scheme && <a href={scheme} className="btn-primary w-full">Open in app</a>}
          {store && <a href={store} className="btn-secondary w-full" rel="noreferrer">Get the app</a>}
          <a href={url} className="btn-ghost w-full" rel="noreferrer">Continue in browser</a>
        </div>
      </div>
      {!noBranding && <p className="mt-6 text-xs text-muted">Powered by {siteName}</p>}
    </div>
  );
}
