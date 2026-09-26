"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Loader2, BarChart3 } from "lucide-react";
import { Switch, Alert } from "@/components/ui";
import { DEFAULT_QR_STYLE, normalizeQrStyle, type QrStyle } from "@/lib/qr-types";
import { bulkCreateQr, type BulkQrResult } from "@/app/dashboard/qr/actions";
import { QrStyleEditor, QrPreview } from "./qr-designer";

export function BulkGenerator({ advanced, defaultLogo, dynamicAllowed }: { advanced: boolean; defaultLogo: string; dynamicAllowed: boolean }) {
  const [text, setText] = useState("");
  const [style, setStyle] = useState<QrStyle>(normalizeQrStyle(DEFAULT_QR_STYLE));
  const [dynamic, setDynamic] = useState(dynamicAllowed);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkQrResult | null>(null);
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const downloadAll = (format: "png" | "svg") => {
    const ids = (result?.created ?? []).map((c) => c.id);
    if (!ids.length) return;
    const a = document.createElement("a"); a.href = `/api/qr/bulk-download?ids=${encodeURIComponent(ids.join(","))}&format=${format}`; a.download = "qr-codes.zip"; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="space-y-5">
        <div className="card p-5 space-y-3">
          <label className="label">URLs (one per line) or CSV rows <span className="text-muted font-normal">name,url</span></label>
          <textarea className="input min-h-56 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={"https://example.com/page-1\nSummer sale,https://example.com/sale\nMenu,https://example.com/menu"} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="hint">{lines} row{lines === 1 ? "" : "s"} · max 200 per batch</p>
            <Switch label="Create as dynamic QR codes" checked={dynamic && dynamicAllowed} disabled={!dynamicAllowed} onChange={setDynamic} />
          </div>
          <button type="button" className="btn-primary" disabled={busy || !lines} onClick={async () => { setBusy(true); setResult(null); const r = await bulkCreateQr(text, style, dynamic); setResult(r); setBusy(false); }}>{busy && <Loader2 size={14} className="animate-spin" />}Generate {lines || ""} QR codes</button>
        </div>
        {result && (
          <div className="card p-5 space-y-3">
            {result.error && <Alert type="error">{result.error}</Alert>}
            {result.created.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-medium">{result.created.length} QR codes created</p>
                  <div className="flex gap-2"><button type="button" className="btn-primary btn-sm" onClick={() => downloadAll("png")}><Download size={14} />Download all as ZIP (PNG)</button><button type="button" className="btn-secondary btn-sm" onClick={() => downloadAll("svg")}><Download size={14} />ZIP (SVG)</button></div>
                </div>
                <table className="table"><thead><tr><th>Name</th><th className="text-right">Download</th></tr></thead>
                  <tbody>{result.created.map((c) => <tr key={c.id}><td><Link href={`/dashboard/qr/${c.id}`} className="hover:underline">{c.name}</Link></td><td className="text-right whitespace-nowrap"><a href={`/api/qr/${c.id}/download?format=png`} className="btn-ghost btn-sm">PNG</a><a href={`/api/qr/${c.id}/download?format=svg`} className="btn-ghost btn-sm">SVG</a><Link href={`/dashboard/qr/${c.id}`} className="btn-ghost btn-sm"><BarChart3 size={14} /></Link></td></tr>)}</tbody></table>
              </>
            )}
            {result.errors.length > 0 && <div className="text-xs text-danger space-y-0.5">{result.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
          </div>
        )}
      </div>
      <div className="space-y-4 lg:sticky lg:top-6 self-start">
        <div className="card p-5 flex flex-col items-center"><QrPreview data="https://example.com" style={style} size={180} /><p className="hint mt-2">Style applied to every code</p></div>
        <div className="card p-5"><QrStyleEditor style={style} onChange={setStyle} advanced={advanced} defaultLogo={defaultLogo} /></div>
      </div>
    </div>
  );
}
