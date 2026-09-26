"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, X, Loader2, Search, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WidgetField } from "@/lib/bio-widgets";

/** Uploads a file through the shared upload endpoint and returns its public URL. */
export async function uploadFile(file: File, folder = "bio"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: string | number };
  if (!res.ok || !j.url) throw new Error(j.message || (typeof j.error === "string" ? j.error : "Upload failed"));
  return j.url;
}

export function UploadInput({ value, onChange, accept = "image/*", folder = "bio", label, hint, preview = true }: { value: string; onChange: (url: string) => void; accept?: string; folder?: string; label?: string; hint?: string; preview?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isImage = accept.startsWith("image") && !!value && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value);
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-2">
        {preview && (isImage ? <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border border-border" /> : value ? <span className="h-10 px-2 rounded-lg border border-border text-xs flex items-center max-w-32 truncate">{value.split("/").pop()}</span> : null)}
        <input className="input flex-1" placeholder="https:// or upload" value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}</button>
        {value && <button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")}><X size={14} /></button>}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; setBusy(true); setErr("");
          try { onChange(await uploadFile(f, folder)); } catch (ex) { setErr(ex instanceof Error ? ex.message : "Upload failed"); } finally { setBusy(false); e.target.value = ""; }
        }} />
      </div>
      {err ? <p className="hint text-danger">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function GiphyPicker({ value, onChange, enabled }: { value: string; onChange: (url: string) => void; enabled: boolean }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<{ id: string; preview: string; url: string; title: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const search = async (term: string) => {
    setBusy(true);
    try { const j = (await (await fetch(`/api/bio/giphy?q=${encodeURIComponent(term)}`)).json()) as { gifs?: typeof gifs; message?: string }; setGifs(j.gifs ?? []); setMsg(j.message ?? ""); } catch { setMsg("Search failed"); } finally { setBusy(false); }
  };
  useEffect(() => { if (enabled) search(""); /* trending */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  if (!enabled) return <div className="text-xs text-muted">GIPHY search is not configured. Paste a GIF URL instead: <input className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://media.giphy.com/…" /></div>;
  return (
    <div className="space-y-2">
      {value && <div className="flex items-center gap-2"><img src={value} alt="" className="h-16 rounded-lg" /><button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")}><X size={14} />Remove</button></div>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(q); }}><input className="input" placeholder="Search GIPHY" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-secondary btn-sm" type="submit">{busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}</button></form>
      {msg && <p className="hint">{msg}</p>}
      <div className="grid grid-cols-4 gap-1 max-h-48 overflow-auto">{gifs.map((g) => <button key={g.id} type="button" title={g.title} onClick={() => onChange(g.url)} className="aspect-square overflow-hidden rounded-md border border-transparent hover:border-primary"><img src={g.preview} alt={g.title} className="h-full w-full object-cover" /></button>)}</div>
    </div>
  );
}

type Item = Record<string, string>;
export function ListEditor({ field, value, onChange, giphyEnabled }: { field: WidgetField; value: unknown; onChange: (v: Item[]) => void; giphyEnabled: boolean }) {
  const items: Item[] = Array.isArray(value) ? (value as Item[]) : [];
  const set = (i: number, k: string, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div>
      <label className="label">{field.label}</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-border p-2 space-y-2 relative">
            {(field.itemFields ?? []).map((f) => <FieldInput key={f.key} field={f} value={it[f.key] ?? ""} onChange={(v) => set(i, f.key, typeof v === "string" ? v : "")} giphyEnabled={giphyEnabled} compact />)}
            <div className="flex justify-end gap-1">
              <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}>↑</button>
              <button type="button" className="btn-ghost btn-sm" disabled={i === items.length - 1} onClick={() => { const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; onChange(a); }}>↓</button>
              <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm" onClick={() => onChange([...items, {}])}><Plus size={14} />Add item</button>
      </div>
    </div>
  );
}

export function FieldInput({ field, value, onChange, giphyEnabled, compact }: { field: WidgetField; value: unknown; onChange: (v: unknown) => void; giphyEnabled: boolean; compact?: boolean }) {
  const v = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const wrap = (node: React.ReactNode) => <div className={cn(compact && "text-sm")}>{field.type !== "toggle" && field.type !== "list" && field.type !== "upload" && <label className="label">{field.label}</label>}{node}{field.hint && <p className="hint">{field.hint}</p>}</div>;
  switch (field.type) {
    case "textarea": case "markdown": return wrap(<textarea className="input min-h-20" placeholder={field.placeholder} value={v} onChange={(e) => onChange(e.target.value)} />);
    case "select": return wrap(<select className="input" value={v} onChange={(e) => onChange(e.target.value)}>{(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>);
    case "toggle": return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v !== "0" && v !== "" ? v === "1" || v === "true" : false} onChange={(e) => onChange(e.target.checked ? "1" : "0")} />{field.label}</label>;
    case "upload": return <UploadInput label={field.label} value={v} onChange={onChange} accept={field.accept ?? "*/*"} hint={field.hint} />;
    case "color": return wrap(<div className="flex gap-2"><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent" /><input className="input" value={v} onChange={(e) => onChange(e.target.value)} placeholder="#000000" /></div>);
    case "date": return wrap(<input type="date" className="input" value={v} onChange={(e) => onChange(e.target.value)} />);
    case "datetime": return wrap(<input type="datetime-local" className="input" value={v} onChange={(e) => onChange(e.target.value)} />);
    case "range": {
      const min = field.min ?? 0, max = field.max ?? 100, n = v === "" || isNaN(Number(v)) ? (field.key === "blockWidth" || field.key === "blockScale" ? 100 : min) : Number(v);
      return (
        <div className={cn(compact && "text-sm")}>
          <div className="flex items-center justify-between"><label className="label">{field.label}</label><span className="text-xs text-muted tabular-nums">{n}{field.unit ?? ""}</span></div>
          <input type="range" min={min} max={max} step={field.step ?? 1} value={n} onChange={(e) => onChange(e.target.value)} className="w-full accent-primary" />
          {field.hint && <p className="hint">{field.hint}</p>}
        </div>
      );
    }
    case "number": return wrap(<input type="number" className="input" placeholder={field.placeholder} value={v} onChange={(e) => onChange(e.target.value)} />);
    case "list": return <ListEditor field={field} value={value} onChange={onChange} giphyEnabled={giphyEnabled} />;
    case "giphy": return wrap(<GiphyPicker value={v} onChange={onChange} enabled={giphyEnabled} />);
    case "email": case "tel": case "url": case "text": default:
      return wrap(<input type={field.type === "url" ? "text" : field.type ?? "text"} className="input" placeholder={field.placeholder} value={v} onChange={(e) => onChange(e.target.value)} />);
  }
}
