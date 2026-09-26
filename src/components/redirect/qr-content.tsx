import type { QrCode } from "@prisma/client";
import { QrCode as QrIcon } from "lucide-react";
import { InterstitialShell } from "./shell";
import { json } from "@/lib/utils";

/** Renders the decoded content of a dynamic QR code that does not point at a URL (text, wifi, vcard, ...). */
export function QrContentPage({ qr, siteName, logo }: { qr: QrCode; siteName: string; logo?: string }) {
  const data = json<Record<string, unknown>>(qr.data, {});
  const entries = Object.keys(data).length ? Object.entries(data).filter(([, v]) => v !== "" && v !== null && v !== undefined) : [];
  return (
    <InterstitialShell meta={{ title: qr.name }} siteName={siteName} logo={logo}>
      <div className="card max-w-md w-full p-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center mb-4"><QrIcon size={22} /></div>
        <h1 className="text-xl font-bold text-center">{qr.name}</h1>
        <p className="text-xs uppercase tracking-wide text-muted text-center mt-1">{qr.type}</p>
        {entries.length ? (
          <dl className="mt-5 space-y-2 text-sm">
            {entries.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border pb-2"><dt className="text-muted capitalize">{k}</dt><dd className="font-medium text-right break-all">{typeof v === "string" ? v : JSON.stringify(v)}</dd></div>)}
          </dl>
        ) : (
          <pre className="mt-5 whitespace-pre-wrap break-all text-sm bg-bg rounded-lg p-4">{qr.data}</pre>
        )}
      </div>
    </InterstitialShell>
  );
}
