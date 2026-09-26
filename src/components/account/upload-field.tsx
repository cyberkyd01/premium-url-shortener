"use client";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui";

/** Uploads a file through /api/upload and exposes the resulting URL in a hidden input. */
export function UploadField({ name, label, folder = "uploads", accept, value, hint, onUploaded }: { name: string; label?: string; folder?: string; accept?: string; value?: string | null; hint?: string; onUploaded?: (url: string) => void }) {
  const [url, setUrl] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const fd = new FormData(); fd.set("file", file); fd.set("folder", folder);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await r.json()) as { url?: string; message?: string };
      if (!r.ok || !d.url) throw new Error(d.message ?? "Upload failed");
      setUrl(d.url); onUploaded?.(d.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-3">
        {url && (accept?.includes("image") ? <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" /> : <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline truncate max-w-48">{url.split("/").pop()}</a>)}
        <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{url ? "Replace" : "Upload"}</Button>
        {url && <Button type="button" variant="ghost" size="sm" onClick={() => { setUrl(""); onUploaded?.(""); }}>Remove</Button>}
      </div>
      <input type="hidden" name={name} value={url} />
      {error ? <p className="hint text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
