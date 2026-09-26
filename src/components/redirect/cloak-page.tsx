import { RawHtml } from "./shell";

/** 200 response with instant meta refresh + JS redirect. Hides the referrer and the short URL from the destination. */
export function CloakPage({ url, title, pixels }: { url: string; title?: string | null; pixels: string }) {
  return (
    <>
      <title>{title || "Redirecting"}</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
      <meta httpEquiv="refresh" content={`0;url=${url}`} />
      <RawHtml html={pixels} className="hidden" />
      <script dangerouslySetInnerHTML={{ __html: `window.location.replace(${JSON.stringify(url)});` }} />
      <noscript><a href={url} rel="noreferrer">Continue</a></noscript>
      <div className="min-h-screen" />
    </>
  );
}
