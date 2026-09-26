import Link from "next/link";
import { Clock, Ban, Hourglass, Globe, ShieldAlert } from "lucide-react";
import { InterstitialShell } from "./shell";

/** Shown when a request arrives on a hostname that is not registered as a custom domain. */
export function DomainWorkingPage({ host, siteName, logo }: { host: string; siteName: string; logo?: string }) {
  return (
    <InterstitialShell meta={{ title: "Domain is working" }} siteName={siteName} logo={logo}>
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-success/15 text-success grid place-items-center mb-4"><Globe size={22} /></div>
        <h1 className="text-2xl font-bold">Yes. Your domain name is working.</h1>
        <p className="text-muted mt-2"><span className="font-medium text-fg">{host}</span> points to {siteName}. Add it to your account now to start using branded short links.</p>
        <Link href="/dashboard/domains" className="btn-primary mt-6">Add domain to my account</Link>
      </div>
    </InterstitialShell>
  );
}

export function LinkStatusPage({ kind, siteName, logo, noBranding }: { kind: "expired" | "limit" | "pending" | "blocked"; siteName: string; logo?: string; noBranding?: boolean }) {
  const map = {
    expired: { icon: Clock, title: "This link has expired", text: "The owner of this short link set an expiration date that has passed." },
    limit: { icon: Hourglass, title: "Click limit reached", text: "This short link has reached the maximum number of clicks allowed by its owner." },
    pending: { icon: ShieldAlert, title: "Awaiting approval", text: "This link is being reviewed and will be available once approved by our team." },
    blocked: { icon: Ban, title: "Link unavailable", text: "This link is disabled or has been blocked for violating our terms of service." },
  } as const;
  const { icon: Icon, title, text } = map[kind];
  return (
    <InterstitialShell meta={{ title }} siteName={siteName} logo={logo} noBranding={noBranding}>
      <div className="card max-w-md w-full p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-warning/15 text-warning grid place-items-center mb-4"><Icon size={22} /></div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted mt-2">{text}</p>
        <Link href="/" className="btn-secondary mt-6">Go to {siteName}</Link>
      </div>
    </InterstitialShell>
  );
}

/** Meta-tags page: served to crawlers without redirect, or to humans as a short intermediary before redirecting (pixels / GA). */
export function MetaRedirectPage({ url, meta, siteName, logo, pixels, delay, redirectNow, noBranding }: {
  url: string; meta: { title?: string | null; description?: string | null; image?: string | null }; siteName: string; logo?: string;
  pixels: string; delay: number; redirectNow: boolean; noBranding?: boolean;
}) {
  const d = Math.max(0, delay);
  return (
    <InterstitialShell meta={{ ...meta, url }} siteName={siteName} logo={logo} pixels={pixels} noBranding={noBranding}>
      {redirectNow && <meta httpEquiv="refresh" content={`${d};url=${url}`} />}
      {redirectNow && <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){window.location.replace(${JSON.stringify(url)})},${d * 1000});` }} />}
      <div className="card max-w-md w-full p-8 text-center">
        {meta.image && <img src={meta.image} alt="" className="rounded-lg max-h-56 mx-auto mb-4 object-cover" />}
        <h1 className="text-xl font-bold">{meta.title || "Redirecting…"}</h1>
        {meta.description && <p className="text-muted mt-2">{meta.description}</p>}
        <p className="text-sm text-muted mt-4">{redirectNow ? "You are being redirected. " : ""}<a href={url} className="text-primary underline" rel="noreferrer">Continue to destination</a></p>
      </div>
    </InterstitialShell>
  );
}
