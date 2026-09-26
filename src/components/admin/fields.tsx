"use client";
import { useState, useRef } from "react";
import { Switch } from "@/components/ui";
import { Upload, X, Plus, Trash2 } from "lucide-react";

/** Switch that submits "0"/"1" under `name`. */
export function SwitchField({ name, label, hint, defaultChecked }: { name: string; label?: string; hint?: string; defaultChecked?: boolean }) {
  const [v, setV] = useState(!!defaultChecked);
  return <Switch name={name} label={label} hint={hint} checked={v} onChange={setV} />;
}

/** Text input + file upload (POST /api/upload → {url}). Stores the URL under `name`. */
export function UploadField({ name, label, hint, defaultValue, folder = "admin", accept = "image/*" }: { name: string; label?: string; hint?: string; defaultValue?: string; folder?: string; accept?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", folder);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { url?: string; path?: string; error?: boolean; message?: string };
      if (!r.ok || !(d.url || d.path)) throw new Error(d.message || "Upload failed");
      setUrl(d.url || d.path || "");
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-2">
        {url && accept.startsWith("image") && <img src={url} alt="" className="h-9 w-9 rounded object-cover border border-border" />}
        <input className="input" name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or upload" />
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}><Upload size={14} />{busy ? "…" : "Upload"}</button>
        {url && <button type="button" className="btn-ghost btn-sm" onClick={() => setUrl("")}><X size={14} /></button>}
      </div>
      {err ? <p className="hint text-danger">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export interface ListField { key: string; label: string; placeholder?: string; type?: "text" | "textarea" }

/** Editable list of objects, serialized as JSON into a hidden input `name`. */
export function ListEditor({ name, label, fields, defaultValue, addLabel = "Add item" }: { name: string; label?: string; fields: ListField[]; defaultValue?: Record<string, string>[]; addLabel?: string }) {
  const [rows, setRows] = useState<Record<string, string>[]>(defaultValue ?? []);
  const update = (i: number, k: string, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-start">
            {fields.map((f) => f.type === "textarea"
              ? <textarea key={f.key} className="input font-mono text-xs min-h-20" placeholder={f.placeholder ?? f.label} value={row[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />
              : <input key={f.key} className="input" placeholder={f.placeholder ?? f.label} value={row[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />)}
            <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setRows((r) => [...r, Object.fromEntries(fields.map((f) => [f.key, ""]))])}><Plus size={14} />{addLabel}</button>
    </div>
  );
}

/** Checkbox group: every checked value is submitted under the same `name` (read with formData.getAll). */
export function CheckboxGroup({ name, label, options, defaultValues, columns = 3 }: { name: string; label?: string; options: { value: string; label: string }[]; defaultValues?: string[]; columns?: number }) {
  const set = new Set(defaultValues ?? []);
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className={`grid gap-2 grid-cols-2 md:grid-cols-${columns}`}>
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name={name} value={o.value} defaultChecked={set.has(o.value)} className="accent-primary" />{o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** A number input with an "Unlimited" (-1) helper. */
export function LimitField({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue: number; hint?: string }) {
  const [v, setV] = useState(String(defaultValue));
  const unlimited = v === "-1";
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input className="input" name={name} type="number" value={v} onChange={(e) => setV(e.target.value)} />
        <label className="text-xs whitespace-nowrap flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={unlimited} onChange={(e) => setV(e.target.checked ? "-1" : "0")} className="accent-primary" />Unlimited</label>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
