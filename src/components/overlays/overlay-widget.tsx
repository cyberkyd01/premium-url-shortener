"use client";
import { useEffect, useState, type FormEvent } from "react";
import { X, Copy, Check } from "lucide-react";

export { OVERLAY_TYPES, OVERLAY_POSITIONS, parseOverlayOptions } from "./overlay-types";
export type { OverlayType, OverlayPosition, OverlayOptions, OverlayData } from "./overlay-types";
import { parseOverlayOptions, type OverlayData } from "./overlay-types";

/** Converts a YouTube / Vimeo / direct video URL into an embeddable source. */
export function videoEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  const u = url.trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  if (/^https?:\/\//.test(u)) return { kind: "iframe", src: u };
  return null;
}

const POSITION_CLASS: Record<string, string> = {
  "bottom-left": "left-4 bottom-4 w-[calc(100%-2rem)] max-w-sm",
  "bottom-right": "right-4 bottom-4 w-[calc(100%-2rem)] max-w-sm",
  top: "left-0 top-0 w-full",
  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md",
  "bottom-bar": "left-0 bottom-0 w-full",
};

/**
 * Renders a CTA overlay widget for a redirect page. Appears after `overlay.delay` seconds (immediately in `preview`).
 * Forms POST JSON `{ overlayId, data }` to `submitUrl` (e.g. /api/overlay-response).
 * `preview` positions the widget absolutely inside a relative container instead of fixed on the viewport.
 */
export function OverlayWidget({ overlay, submitUrl, preview = false, onClose }: { overlay: OverlayData; submitUrl: string; preview?: boolean; onClose?: () => void }) {
  const opts = parseOverlayOptions(overlay.options);
  const delay = preview ? 0 : Math.max(0, overlay.delay ?? 0);
  const [visible, setVisible] = useState(delay === 0);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState("");
  useEffect(() => {
    if (delay === 0) { setVisible(true); return; }
    const t = setTimeout(() => setVisible(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);
  useEffect(() => { if (preview) { setClosed(false); setDone(false); setError(null); } }, [preview, overlay.type, overlay.position]);
  if (!visible || closed) return null;

  const bg = overlay.bgColor || "#ffffff";
  const fg = overlay.textColor || "#111827";
  const accent = overlay.accentColor || "#6366f1";
  const isBar = overlay.position === "top" || overlay.position === "bottom-bar";
  const isCenter = overlay.position === "center";
  const positionClass = POSITION_CLASS[overlay.position] ?? POSITION_CLASS["bottom-left"];
  const close = () => { setClosed(true); onClose?.(); };
  const target = opts.buttonNewTab ? "_blank" : undefined;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (preview) { setDone(true); return; }
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === "string") data[k] = v; });
    setBusy(true); setError(null);
    try {
      const res = await fetch(submitUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ overlayId: overlay.id, data }) });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { message?: string; error?: unknown }; throw new Error(j.message || (typeof j.error === "string" ? j.error : "") || "Could not submit"); }
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not submit"); } finally { setBusy(false); }
  };

  const inputStyle = { background: "rgba(127,127,127,0.08)", color: fg, border: "1px solid rgba(127,127,127,0.3)" };
  const inputClass = "w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-2";
  const btnClass = "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50";
  const success = <p className="text-sm font-medium py-2">{opts.successMessage || "Thank you!"}</p>;
  const disclaimer = overlay.disclaimer ? <p className="text-[11px] opacity-60 mt-2 leading-snug">{overlay.disclaimer}</p> : null;
  const fields = opts.formFields?.length ? opts.formFields : (["name", "email", "message"] as const);

  let body: React.ReactNode;
  switch (overlay.type) {
    case "contact":
      body = done ? success : (
        <form onSubmit={submit} className="space-y-2">
          {overlay.title && <p className="font-semibold">{overlay.title}</p>}
          {overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}
          {fields.includes("name") && <input name="name" placeholder="Your name" required className={inputClass} style={inputStyle} />}
          {fields.includes("email") && <input name="email" type="email" placeholder="Email address" required className={inputClass} style={inputStyle} />}
          {fields.includes("message") && <textarea name="message" placeholder="Message" required rows={3} className={inputClass} style={inputStyle} />}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={busy} className={btnClass} style={{ background: accent }}>{overlay.buttonText || "Send"}</button>
          {disclaimer}
        </form>
      );
      break;
    case "newsletter":
      body = done ? success : (
        <form onSubmit={submit} className={isBar ? "flex flex-wrap items-center gap-2" : "space-y-2"}>
          <div className={isBar ? "flex-1 min-w-40" : ""}>{overlay.title && <p className="font-semibold">{overlay.title}</p>}{overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}</div>
          <div className={isBar ? "flex items-center gap-2" : "flex items-center gap-2"}>
            <input name="email" type="email" placeholder="Email address" required className={inputClass} style={inputStyle} />
            <button type="submit" disabled={busy} className={btnClass} style={{ background: accent }}>{overlay.buttonText || "Subscribe"}</button>
          </div>
          {error && <p className="text-xs text-red-500 w-full">{error}</p>}
          {!isBar && disclaimer}
        </form>
      );
      break;
    case "poll": {
      const options = (opts.pollOptions ?? []).filter(Boolean);
      body = done ? success : (
        <form onSubmit={submit} className="space-y-2">
          <p className="font-semibold">{overlay.title || "Quick poll"}</p>
          {overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}
          <div className="space-y-1">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer" style={{ border: `1px solid ${answer === o ? accent : "rgba(127,127,127,0.3)"}` }}>
                <input type="radio" name="answer" value={o} checked={answer === o} onChange={() => setAnswer(o)} required style={{ accentColor: accent }} />{o}
              </label>
            ))}
            {options.length === 0 && <p className="text-xs opacity-60">Add poll options to see them here.</p>}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={busy || !answer} className={btnClass} style={{ background: accent }}>{overlay.buttonText || "Vote"}</button>
          {disclaimer}
        </form>
      );
      break;
    }
    case "image":
      body = (
        <div className={isBar ? "flex items-center gap-3" : "space-y-2"}>
          {overlay.image ? (
            overlay.buttonUrl ? <a href={overlay.buttonUrl} target={target} rel="noopener"><img src={overlay.image} alt={overlay.title ?? ""} className={isBar ? "h-14 w-auto rounded-md object-cover" : "w-full rounded-md object-cover"} /></a> : <img src={overlay.image} alt={overlay.title ?? ""} className={isBar ? "h-14 w-auto rounded-md object-cover" : "w-full rounded-md object-cover"} />
          ) : <div className="h-24 rounded-md flex items-center justify-center text-xs opacity-60" style={{ border: "1px dashed rgba(127,127,127,0.4)" }}>Upload an image</div>}
          <div className="flex-1">{overlay.title && <p className="font-semibold">{overlay.title}</p>}{overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}</div>
          {overlay.buttonText && overlay.buttonUrl && <a href={overlay.buttonUrl} target={target} rel="noopener" className={btnClass} style={{ background: accent }}>{overlay.buttonText}</a>}
        </div>
      );
      break;
    case "video": {
      const embed = overlay.video ? videoEmbed(overlay.video) : null;
      body = (
        <div className="space-y-2">
          {overlay.title && <p className="font-semibold">{overlay.title}</p>}
          {embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
              {embed.kind === "iframe" ? <iframe src={embed.src} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen title={overlay.title ?? "Video"} /> : <video src={embed.src} controls className="h-full w-full" />}
            </div>
          ) : <div className="aspect-video rounded-md flex items-center justify-center text-xs opacity-60" style={{ border: "1px dashed rgba(127,127,127,0.4)" }}>Enter a YouTube, Vimeo or MP4 URL</div>}
          {overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}
          {overlay.buttonText && overlay.buttonUrl && <a href={overlay.buttonUrl} target={target} rel="noopener" className={btnClass} style={{ background: accent }}>{overlay.buttonText}</a>}
        </div>
      );
      break;
    }
    case "cta":
      body = (
        <div className={isBar ? "flex flex-wrap items-center gap-3" : "space-y-3 text-center"}>
          <div className="flex-1 min-w-40"><p className={isBar ? "font-semibold" : "text-lg font-bold"}>{overlay.title || "Your headline"}</p>{overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}</div>
          <a href={overlay.buttonUrl || "#"} target={target} rel="noopener" onClick={(e) => { if (preview || !overlay.buttonUrl) e.preventDefault(); }} className={btnClass + (isBar ? "" : " w-full py-3")} style={{ background: accent }}>{overlay.buttonText || "Get started"}</a>
        </div>
      );
      break;
    case "coupon": {
      const code = opts.couponCode || "SAVE10";
      body = (
        <div className={isBar ? "flex flex-wrap items-center gap-3" : "space-y-2 text-center"}>
          <div className="flex-1 min-w-40">{overlay.title && <p className="font-semibold">{overlay.title}</p>}{overlay.message && <p className="text-sm opacity-80">{overlay.message}</p>}</div>
          <div className="flex items-center gap-2 justify-center">
            <code className="rounded-md px-3 py-2 text-sm font-mono font-bold tracking-wider" style={{ border: `2px dashed ${accent}`, color: accent }}>{code}</code>
            <button type="button" className={btnClass} style={{ background: accent }} onClick={async () => { try { await navigator.clipboard.writeText(code); } catch { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
            {overlay.buttonText && overlay.buttonUrl && <a href={overlay.buttonUrl} target={target} rel="noopener" className="text-sm font-medium underline" style={{ color: accent }}>{overlay.buttonText}</a>}
          </div>
        </div>
      );
      break;
    }
    default: // message
      body = (
        <div className={isBar ? "flex flex-wrap items-center gap-3" : "space-y-2"}>
          {overlay.image && !isBar && <img src={overlay.image} alt="" className="w-full rounded-md object-cover max-h-40" />}
          <div className="flex-1 min-w-40">{overlay.title && <p className="font-semibold">{overlay.title}</p>}{overlay.message && <p className="text-sm opacity-80 whitespace-pre-line">{overlay.message}</p>}</div>
          {overlay.buttonText && <a href={overlay.buttonUrl || "#"} target={target} rel="noopener" onClick={(e) => { if (preview || !overlay.buttonUrl) e.preventDefault(); }} className={btnClass} style={{ background: accent }}>{overlay.buttonText}</a>}
        </div>
      );
  }

  return (
    <>
      {isCenter && <div className={`${preview ? "absolute" : "fixed"} inset-0 z-[9998] bg-black/40`} onClick={close} />}
      <div className={`${preview ? "absolute" : "fixed"} z-[9999] ${positionClass} overlay-widget overlay-${overlay.type} overlay-${overlay.position}`} style={{ background: bg, color: fg, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", borderRadius: isBar ? 0 : 12, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }} role="dialog">
        {(opts.showClose ?? true) && <button type="button" onClick={close} aria-label="Close" className="absolute right-2 top-2 rounded-full p-1 opacity-60 hover:opacity-100" style={{ color: fg }}><X size={14} /></button>}
        <div className={isBar ? "px-4 py-3 pr-9 max-w-6xl mx-auto" : "p-4 pr-8"}>{body}{isBar && overlay.type === "newsletter" && disclaimer}</div>
      </div>
    </>
  );
}
