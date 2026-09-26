"use client";
import { useEffect, useState } from "react";
import { Modal, CopyButton } from "@/components/ui";
import { Link2, Loader2 } from "lucide-react";

/** CTRL+K quick shortener available anywhere in the dashboard. */
export function QuickShorten() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ short?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setResult(null);
    const r = await fetch("/api/shorten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
    const d = await r.json(); setLoading(false);
    setResult(d.error ? { error: d.message } : { short: d.short });
  }
  return (
    <>
      <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}><Link2 size={14} /> Quick shorten <kbd className="hidden md:inline text-[10px] text-muted ml-1">Ctrl+K</kbd></button>
      <Modal open={open} onClose={() => { setOpen(false); setResult(null); setUrl(""); }} title="Quick shorten">
        <form onSubmit={submit} className="flex gap-2">
          <input className="input" placeholder="https://example.com/long-url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus required />
          <button className="btn-primary" disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : "Shorten"}</button>
        </form>
        {result?.error && <p className="text-danger text-sm mt-3">{result.error}</p>}
        {result?.short && <div className="mt-3 flex items-center gap-2 text-sm"><a href={result.short} target="_blank" className="text-primary font-medium truncate">{result.short}</a><CopyButton text={result.short} /></div>}
      </Modal>
    </>
  );
}
