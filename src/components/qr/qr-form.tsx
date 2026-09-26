"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { QR_TYPES, QR_TYPE_FIELDS, encodeQrData, isDynamicCapable, DEFAULT_QR_STYLE, normalizeQrStyle, encodeQrStyle, type QrStyle, type QrField } from "@/lib/qr-types";
import { Switch, Alert } from "@/components/ui";
import { UploadInput } from "@/components/bio/builder/fields";
import { saveQr, type QrInput } from "@/app/dashboard/qr/actions";
import { QrPreview, QrStyleEditor, downloadClientQr } from "./qr-designer";

export interface QrFormOptions {
  links: { id: string; label: string; url: string }[]; bios: { id: string; label: string; url: string }[]; channels: { id: string; name: string }[];
  allowedTypes: string[]; advanced: boolean; dynamicAllowed: boolean; defaultLogo: string; baseUrl: string; alias?: string | null;
}

export function QrTypeFields({ type, data, onChange, uploads = true }: { type: string; data: Record<string, string>; onChange: (d: Record<string, string>) => void; uploads?: boolean }) {
  const fields: QrField[] = QR_TYPE_FIELDS[type as keyof typeof QR_TYPE_FIELDS] ?? [];
  const set = (k: string, v: string) => onChange({ ...data, [k]: v });
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {fields.map((f) => {
        const full = f.type === "textarea" || fields.length === 1;
        const v = data[f.key] ?? "";
        return (
          <div key={f.key} className={cn(full && "sm:col-span-2")}>
            {f.type === "upload" ? (uploads ? <UploadInput label={f.label} value={v} onChange={(x) => set(f.key, x)} folder="qr" hint={f.hint} /> : <><label className="label">{f.label}</label><input className="input" value={v} placeholder="https://" onChange={(e) => set(f.key, e.target.value)} /></>) : (
              <>
                <label className="label">{f.label}{f.required && <span className="text-danger"> *</span>}</label>
                {f.type === "textarea" ? <textarea className="input min-h-20" placeholder={f.placeholder} value={v} onChange={(e) => set(f.key, e.target.value)} />
                  : f.type === "select" ? <select className="input" value={v || f.options?.[0]?.value || ""} onChange={(e) => set(f.key, e.target.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  : <input type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : f.type === "url" ? "text" : f.type ?? "text"} step={f.type === "number" ? "any" : undefined} className="input" placeholder={f.placeholder} value={v} onChange={(e) => set(f.key, e.target.value)} />}
                {f.hint && <p className="hint">{f.hint}</p>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QrForm({ id, initial, options }: { id: string | null; initial: QrInput; options: QrFormOptions }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [data, setData] = useState<Record<string, string>>(initial.data);
  const [isDynamic, setDynamic] = useState(initial.isDynamic);
  const [linkId, setLinkId] = useState(initial.linkId);
  const [bioPageId, setBioPageId] = useState(initial.bioPageId);
  const [channelId, setChannelId] = useState(initial.channelId);
  const [style, setStyle] = useState<QrStyle>(normalizeQrStyle({ ...DEFAULT_QR_STYLE, ...initial.style }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dynamicOk = isDynamicCapable(type) && options.dynamicAllowed;
  const payload = useMemo(() => {
    if (isDynamic && dynamicOk) return options.alias ? `${options.baseUrl}/${options.alias}` : `${options.baseUrl}/xxxxxx`;
    if (type === "link") return options.links.find((l) => l.id === linkId)?.url ?? `${options.baseUrl}/…`;
    if (type === "bio") return options.bios.find((b) => b.id === bioPageId)?.url ?? `${options.baseUrl}/…`;
    return encodeQrData(type, data) || " ";
  }, [type, data, isDynamic, dynamicOk, linkId, bioPageId, options]);

  const submit = async () => {
    setBusy(true); setError("");
    const res = await saveQr(id, { name, type, data, isDynamic: isDynamic && dynamicOk, linkId, bioPageId, channelId, style });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Failed"); return; }
    router.push(`/dashboard/qr/${res.id}`);
    router.refresh();
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="space-y-5">
        <div className="card p-5 space-y-4">
          <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My QR code" /></div>
          <div>
            <label className="label">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {QR_TYPES.map((t) => { const locked = !options.allowedTypes.includes(t.type); return <button key={t.type} type="button" title={locked ? "Upgrade to unlock" : t.description} disabled={locked} onClick={() => { setType(t.type); setData({}); }} className={cn("px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40", type === t.type ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-bg")}>{t.label}{locked && <Lock size={10} className="inline ml-1" />}</button>; })}
            </div>
            <p className="hint">{QR_TYPES.find((t) => t.type === type)?.description}</p>
          </div>
          {type === "link" ? (
            <div><label className="label">Short link</label><select className="input" value={linkId ?? ""} onChange={(e) => setLinkId(e.target.value || null)}><option value="">Choose a link…</option>{options.links.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>{!options.links.length && <p className="hint">You have no links yet. <Link href="/dashboard/links/new" className="underline">Create one</Link>.</p>}</div>
          ) : type === "bio" ? (
            <div><label className="label">Bio page</label><select className="input" value={bioPageId ?? ""} onChange={(e) => setBioPageId(e.target.value || null)}><option value="">Choose a bio page…</option>{options.bios.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>{!options.bios.length && <p className="hint">You have no bio pages yet. <Link href="/dashboard/bio" className="underline">Create one</Link>.</p>}</div>
          ) : <QrTypeFields type={type} data={data} onChange={setData} />}
          {type === "app" && <p className="hint">A short link with device targeting is created automatically so the QR sends iOS users to the App Store and Android users to Google Play.</p>}
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <Switch label="Dynamic QR code" hint={dynamicOk ? "Encodes a short tracking URL so you can change the destination later and see scans" : isDynamicCapable(type) ? "Dynamic QR codes are not included in your plan" : "This type can only be static"} checked={isDynamic && dynamicOk} disabled={!dynamicOk} onChange={setDynamic} />
            <div><label className="label">Channel</label><select className="input" value={channelId ?? ""} onChange={(e) => setChannelId(e.target.value || null)}><option value="">None</option>{options.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Design</h3>
          {!options.advanced && <div className="mb-3"><Alert type="info">Advanced styles, frames and logos require a plan upgrade. <Link href="/dashboard/billing" className="underline">Upgrade</Link></Alert></div>}
          <QrStyleEditor style={style} onChange={setStyle} advanced={options.advanced} defaultLogo={options.defaultLogo} />
        </div>
      </div>
      <div className="lg:sticky lg:top-6 self-start space-y-3">
        <div className="card p-5 flex flex-col items-center gap-3">
          <QrPreview data={payload} style={style} size={240} />
          <p className="text-xs text-muted break-all text-center max-w-full line-clamp-3">{payload}</p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>{busy && <Loader2 size={14} className="animate-spin" />}{id ? "Save changes" : "Create QR code"}</button>
          <div className="flex gap-2 w-full">
            {id ? (<>
              <a className="btn-secondary btn-sm flex-1" href={`/api/qr/${id}/download?format=png`}><Download size={14} />PNG</a>
              <a className="btn-secondary btn-sm flex-1" href={`/api/qr/${id}/download?format=svg`}><Download size={14} />SVG</a>
              <a className="btn-secondary btn-sm flex-1" href={`/api/qr/${id}/download?format=pdf`}><Download size={14} />PDF</a>
            </>) : (<>
              <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => downloadClientQr(payload, style, name || "qr-code", "png")}><Download size={14} />PNG</button>
              <a className="btn-secondary btn-sm flex-1" href={`/api/qr/render?data=${encodeURIComponent(payload)}&format=svg&style=${encodeQrStyle(style)}`} download={(name || "qr-code") + ".svg"}><Download size={14} />SVG</a>
            </>)}
          </div>
          {id && <p className="hint text-center">Downloads include frames and logos at high resolution.</p>}
        </div>
        <Link href="/dashboard/qr" className="btn-ghost btn-sm"><ArrowLeft size={14} />Back to QR codes</Link>
      </div>
    </div>
  );
}
