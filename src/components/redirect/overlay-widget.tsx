"use client";
import { useEffect, useState, type FormEvent } from "react";
import { X, Copy, Check, ExternalLink } from "lucide-react";

export interface OverlayConfig {
  id: string; type: string; position: string; title: string | null; message: string | null; buttonText: string | null; buttonUrl: string | null;
  image: string | null; video: string | null; bgColor: string; textColor: string; accentColor: string; delay: number; disclaimer: string | null;
  options: { pollOptions?: string[]; code?: string; fields?: string[]; placeholder?: string; successMessage?: string };
}

function videoEmbed(v: string) {
  const yt = v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = v.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Full-screen iframe of the destination + the configured overlay widget. */
export function OverlayPage({ url, overlay, siteName, noBranding }: { url: string; overlay: OverlayConfig; siteName: string; noBranding?: boolean }) {
  return (
    <div className="h-screen flex flex-col">
      <iframe src={url} title="Destination" className="flex-1 w-full border-0 bg-white" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />
      <div className="shrink-0 px-3 py-1 text-[11px] text-muted bg-card border-t border-border flex items-center justify-between gap-2">
        <span>Content not loading? <a href={url} className="text-primary" rel="noreferrer">Open the page directly</a>.</span>
        {!noBranding && <span>Powered by {siteName}</span>}
      </div>
      <OverlayWidget overlay={overlay} />
    </div>
  );
}

export function OverlayWidget({ overlay }: { overlay: OverlayConfig }) {
  const [visible, setVisible] = useState(overlay.delay <= 0);
  const [closed, setClosed] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (overlay.delay > 0) { const t = setTimeout(() => setVisible(true), overlay.delay * 1000); return () => clearTimeout(t); } }, [overlay.delay]);
  if (!visible || closed) return null;

  async function submit(data: Record<string, string>) {
    setBusy(true);
    try {
      await fetch("/api/overlay-response", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ overlayId: overlay.id, data }) });
      setDone(true);
    } finally { setBusy(false); }
  }
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = String(v); });
    void submit(data);
  }

  const pos: Record<string, string> = {
    "bottom-left": "left-4 bottom-4 w-[min(360px,calc(100vw-2rem))]",
    "bottom-right": "right-4 bottom-4 w-[min(360px,calc(100vw-2rem))]",
    top: "top-4 left-1/2 -translate-x-1/2 w-[min(480px,calc(100vw-2rem))]",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,calc(100vw-2rem))]",
    "bottom-bar": "left-0 right-0 bottom-0 w-full rounded-none",
  };
  const style = { background: overlay.bgColor, color: overlay.textColor };
  const btn = { background: overlay.accentColor, color: "#fff" };
  const success = overlay.options.successMessage || "Thank you!";
  const embed = overlay.video ? videoEmbed(overlay.video) : null;

  return (
    <div className={"fixed z-50 rounded-xl shadow-2xl border border-black/10 p-4 animate-in " + (pos[overlay.position] ?? pos["bottom-left"])} style={style}>
      <button type="button" onClick={() => setClosed(true)} className="absolute top-2 right-2 opacity-60 hover:opacity-100" aria-label="Close"><X size={16} /></button>
      <div className={overlay.position === "bottom-bar" ? "max-w-4xl mx-auto flex flex-wrap items-center gap-4" : "space-y-3"}>
        {overlay.image && overlay.type !== "video" && <img src={overlay.image} alt="" className={overlay.position === "bottom-bar" ? "h-12 rounded" : "w-full rounded-lg max-h-48 object-cover"} />}
        {overlay.type === "video" && (embed ? <iframe src={embed} className="w-full aspect-video rounded-lg" allow="autoplay; encrypted-media" allowFullScreen title="Video" /> : overlay.video ? <video src={overlay.video} controls className="w-full rounded-lg" /> : null)}
        <div className="flex-1 min-w-0">
          {overlay.title && <p className="font-semibold">{overlay.title}</p>}
          {overlay.message && <p className="text-sm opacity-80 mt-0.5 whitespace-pre-line">{overlay.message}</p>}
        </div>
        {done ? <p className="text-sm font-medium">{success}</p> : (
          <>
            {overlay.type === "contact" && (
              <form onSubmit={onSubmit} className="space-y-2 w-full">
                <input name="name" placeholder="Your name" className="input" required />
                <input name="email" type="email" placeholder="Email" className="input" required />
                <textarea name="message" placeholder="Message" className="input min-h-20" required />
                <button className="btn-primary w-full" style={btn} disabled={busy}>{overlay.buttonText || "Send"}</button>
              </form>
            )}
            {overlay.type === "newsletter" && (
              <form onSubmit={onSubmit} className="flex gap-2 w-full">
                <input name="email" type="email" placeholder={overlay.options.placeholder || "Your email"} className="input" required />
                <button className="btn-primary" style={btn} disabled={busy}>{overlay.buttonText || "Subscribe"}</button>
              </form>
            )}
            {overlay.type === "poll" && (
              <div className="space-y-2 w-full">
                {(overlay.options.pollOptions ?? []).map((o) => <button key={o} type="button" disabled={busy} onClick={() => submit({ vote: o })} className="btn-secondary w-full justify-start" style={{ color: overlay.textColor }}>{o}</button>)}
              </div>
            )}
            {overlay.type === "coupon" && (
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 rounded-lg border border-dashed border-current font-mono text-sm flex-1 text-center">{overlay.options.code || ""}</code>
                <button type="button" className="btn-primary" style={btn} onClick={async () => { try { await navigator.clipboard.writeText(overlay.options.code || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                {overlay.buttonUrl && <a href={overlay.buttonUrl} target="_blank" rel="noreferrer" className="btn-primary" style={btn}>{overlay.buttonText || "Shop"}</a>}
              </div>
            )}
            {(overlay.type === "message" || overlay.type === "cta" || overlay.type === "image" || overlay.type === "video") && overlay.buttonUrl && (
              <a href={overlay.buttonUrl} target="_blank" rel="noreferrer" className="btn-primary" style={btn} onClick={() => submit({ click: overlay.buttonUrl ?? "" })}>{overlay.buttonText || "Learn more"} <ExternalLink size={14} /></a>
            )}
          </>
        )}
        {overlay.disclaimer && <p className="text-[11px] opacity-60 w-full">{overlay.disclaimer}</p>}
      </div>
    </div>
  );
}
