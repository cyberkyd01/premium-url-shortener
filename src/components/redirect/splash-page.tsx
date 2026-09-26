import Link from "next/link";
import { Flag } from "lucide-react";
import { InterstitialShell, RawHtml, Brand, type LinkMeta } from "./shell";
import { CountdownButton } from "./countdown-button";
import { ShareButtons } from "./share-buttons";
import { hostOf } from "@/lib/utils";

export function SplashPage({ url, shortUrl, alias, meta, siteName, logo, pixels, countdown, adTop, adBottom, noBranding }: {
  url: string; shortUrl: string; alias: string; meta: LinkMeta; siteName: string; logo?: string; pixels: string; countdown: number; adTop: string; adBottom: string; noBranding?: boolean;
}) {
  return (
    <InterstitialShell meta={{ ...meta, url: shortUrl }} siteName={siteName} logo={logo} pixels={pixels} noBranding={noBranding}>
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between"><Brand siteName={siteName} logo={logo} /><ShareButtons url={shortUrl} title={meta.title} /></div>
        {adTop && <RawHtml html={adTop} className="text-center" />}
        <div className="card overflow-hidden">
          {meta.image && <img src={meta.image} alt="" className="w-full max-h-72 object-cover" />}
          <div className="p-6">
            <p className="text-xs uppercase tracking-wide text-muted mb-1">{hostOf(url) || "Destination"}</p>
            <h1 className="text-xl font-bold">{meta.title || url}</h1>
            {meta.description && <p className="text-muted mt-2">{meta.description}</p>}
            <p className="text-xs text-muted mt-3 break-all">{url}</p>
            <div className="mt-5"><CountdownButton url={url} seconds={countdown} /></div>
          </div>
        </div>
        {adBottom && <RawHtml html={adBottom} className="text-center" />}
        <p className="text-center text-xs text-muted"><Link href={`/report?url=${encodeURIComponent(shortUrl)}&alias=${encodeURIComponent(alias)}`} className="inline-flex items-center gap-1 hover:text-fg"><Flag size={11} /> Report this link</Link></p>
      </div>
    </InterstitialShell>
  );
}
