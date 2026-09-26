"use client";
import { useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui";

/** Multi-file uploader through /api/upload; emits a JSON array of URLs in a hidden input. */
export function AttachmentsField({ name = "attachments", folder = "attachments", label = "Attachments", max = 5 }: { name?: string; folder?: string; label?: string; max?: number }) {
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function upload(list: FileList) {
    setBusy(true); setError("");
    try {
      for (const f of Array.from(list).slice(0, max - files.length)) {
        const fd = new FormData(); fd.set("file", f); fd.set("folder", folder);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const d = (await r.json()) as { url?: string; message?: string };
        if (!r.ok || !d.url) throw new Error(d.message ?? "Upload failed");
        setFiles((prev) => [...prev, { url: d.url!, name: f.name }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f) => <span key={f.url} className="badge-gray gap-1">{f.name}<button type="button" onClick={() => setFiles(files.filter((x) => x.url !== f.url))}><X size={12} /></button></span>)}
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
        {files.length < max && <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}Add file</Button>}
      </div>
      <input type="hidden" name={name} value={JSON.stringify(files.map((f) => f.url))} />
      {error && <p className="hint text-danger">{error}</p>}
    </div>
  );
}
