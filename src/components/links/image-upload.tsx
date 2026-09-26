"use client";
import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";

/** Uploads an image via /api/upload (multipart `file`) and returns the public URL. */
export function ImageUpload({ value, onChange, label = "Image", folder = "links", disabled }: { value: string | null; onChange: (url: string | null) => void; label?: string; folder?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", folder);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await r.json()) as { url?: string; error?: unknown; message?: string };
      if (!r.ok || !d.url) throw new Error(d.message || "Upload failed");
      onChange(d.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        {value ? <img src={value} alt="" className="h-14 w-14 rounded-lg object-cover border border-border" /> : <div className="h-14 w-14 rounded-lg border border-dashed border-border grid place-items-center text-muted"><Upload size={16} /></div>}
        <div className="flex-1 space-y-1">
          <input className="input" placeholder="https://… or upload" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />
          <div className="flex items-center gap-2">
            <label className={"btn-secondary btn-sm cursor-pointer " + (disabled ? "opacity-50 pointer-events-none" : "")}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload<input type="file" accept="image/*" className="hidden" disabled={disabled || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
            {value && <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}><X size={14} /> Remove</button>}
          </div>
          {error && <p className="hint text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
