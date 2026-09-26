import type { ReactNode } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";

export interface LinkMeta { title?: string | null; description?: string | null; image?: string | null; url?: string | null }

/** Head tags (hoisted by React 19) for a short link: title + Open Graph / Twitter cards. */
export function MetaTags({ meta, siteName, noindex = true }: { meta: LinkMeta; siteName: string; noindex?: boolean }) {
  const title = meta.title || siteName;
  return (
    <>
      <title>{title}</title>
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:type" content="website" />
      {meta.description && <meta name="description" content={meta.description} />}
      {meta.description && <meta property="og:description" content={meta.description} />}
      {meta.image && <meta property="og:image" content={meta.image} />}
      {meta.url && <meta property="og:url" content={meta.url} />}
      <meta name="twitter:card" content={meta.image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={title} />
      {meta.description && <meta name="twitter:description" content={meta.description} />}
      {meta.image && <meta name="twitter:image" content={meta.image} />}
    </>
  );
}

/** Raw tracking HTML (pixels, GA, ads). Rendered server-side so scripts execute on parse. */
export function RawHtml({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Common wrapper for interstitial pages: meta tags, pixels, optional branding footer. */
export function InterstitialShell({ children, meta, siteName, logo, pixels = "", noBranding = false, fullscreen = false }: {
  children: ReactNode; meta: LinkMeta; siteName: string; logo?: string; pixels?: string; noBranding?: boolean; fullscreen?: boolean;
}) {
  return (
    <>
      <MetaTags meta={meta} siteName={siteName} />
      <RawHtml html={pixels} className="hidden" />
      {fullscreen ? children : (
        <div className="min-h-screen flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">{children}</div>
          {!noBranding && (
            <footer className="py-4 text-center text-xs text-muted">
              <Link href="/" className="inline-flex items-center gap-1.5 hover:text-fg">{logo ? <img src={logo} alt="" className="h-4" /> : <Link2 size={12} />} Powered by {siteName}</Link>
            </footer>
          )}
        </div>
      )}
    </>
  );
}

export function Brand({ siteName, logo, className }: { siteName: string; logo?: string; className?: string }) {
  return (
    <Link href="/" className={"flex items-center gap-2 font-bold " + (className ?? "")}>
      {logo ? <img src={logo} alt={siteName} className="h-7" /> : <><span className="h-7 w-7 rounded-lg bg-primary text-primary-fg grid place-items-center"><Link2 size={15} /></span><span className="truncate">{siteName}</span></>}
    </Link>
  );
}
