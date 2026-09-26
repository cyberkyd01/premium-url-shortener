"use client";
import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Uploads an image via POST /api/upload (multipart, field "file") and reports the returned URL. */
export function ImageUpload({ label, name, value, onChange, hint, accept = "image/*", className }: { label: string; name: string; value: string; onChange: (url: string) => void; hint?: string; accept?: string; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string; error?: unknown };
      if (!res.ok || !data.url) throw new Error(data.message || (typeof data.error === "string" ? data.error : "") || "Upload failed");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="h-14 w-14 rounded-lg object-cover border border-border bg-bg" /> : <div className="h-14 w-14 rounded-lg border border-dashed border-border flex items-center justify-center text-muted"><Upload size={16} /></div>}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <button type="button" className={cn("btn-secondary btn-sm")} disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{value ? "Replace" : "Upload"}</button>
            {value && <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => onChange("")}><X size={14} />Remove</button>}
          </div>
          <input className="input text-xs" placeholder="…or paste an image URL" value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      {error ? <p className="hint text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
