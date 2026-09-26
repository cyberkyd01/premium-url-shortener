import { ExternalLink, X } from "lucide-react";
import { InterstitialShell, RawHtml, Brand, type LinkMeta } from "./shell";
import { ShareButtons } from "./share-buttons";

export function FramePage({ url, shortUrl, meta, siteName, logo, pixels, ad, noBranding }: {
  url: string; shortUrl: string; meta: LinkMeta; siteName: string; logo?: string; pixels: string; ad: string; noBranding?: boolean;
}) {
  return (
    <InterstitialShell meta={{ ...meta, url: shortUrl }} siteName={siteName} logo={logo} pixels={pixels} noBranding={noBranding} fullscreen>
      <div className="h-screen flex flex-col">
        <header className="h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4 bg-card border-b border-border">
          <Brand siteName={siteName} logo={logo} className="text-sm shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {meta.title && <span className="text-sm font-medium truncate hidden sm:inline">{meta.title}</span>}
            {ad && <RawHtml html={ad} className="hidden md:block flex-1 text-center overflow-hidden max-h-12" />}
          </div>
          <ShareButtons url={shortUrl} title={meta.title} />
          <a href={url} className="btn-primary btn-sm" rel="noreferrer" title="Close frame and open the page directly"><X size={14} /> <span className="hidden sm:inline">Close frame</span></a>
        </header>
        <iframe src={url} title={meta.title ?? "Framed content"} className="flex-1 w-full border-0 bg-white" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
        <div className="shrink-0 px-3 py-1.5 text-[11px] text-muted bg-card border-t border-border flex items-center justify-between gap-2">
          <span>Content not loading? Some websites refuse to be displayed inside a frame.</span>
          <a href={url} className="inline-flex items-center gap-1 text-primary" rel="noreferrer"><ExternalLink size={11} /> Open directly</a>
        </div>
      </div>
    </InterstitialShell>
  );
}
