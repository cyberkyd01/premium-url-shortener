"use client";
import { useEffect, useRef, useState } from "react";
import type QRCodeStyling from "qr-code-styling";
import { Lock, Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { qrStylingOptions, QR_STYLE_TEMPLATES, type QrStyle, type QrDotType, type QrCornerSquareType, type QrCornerDotType, type QrFrameType } from "@/lib/qr-types";
import { uploadFile } from "@/components/bio/builder/fields";

/** Live QR preview rendered with qr-code-styling (frames are emulated with CSS around the code). */
export function QrPreview({ data, style, size = 260, className }: { data: string; style: QrStyle; size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<QRCodeStyling | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("qr-code-styling");
      if (cancelled || !ref.current) return;
      const opts = { ...qrStylingOptions(data, { ...style, size }), width: size, height: size };
      if (!inst.current) { inst.current = new mod.default(opts); ref.current.innerHTML = ""; inst.current.append(ref.current); }
      else inst.current.update(opts);
    })();
    return () => { cancelled = true; };
  }, [data, style, size]);
  const pad = style.frame === "none" ? 0 : Math.round(size * 0.06);
  const bg = style.bg === "transparent" ? "transparent" : style.bg;
  return (
    <div className={cn("inline-flex flex-col items-center", className)} style={{ padding: pad, border: style.frame === "none" ? "none" : `${Math.max(2, pad / 3)}px solid ${style.frameColor}`, borderRadius: style.frame === "none" ? 0 : pad * 1.5, background: bg, position: "relative", ...(style.frame === "badge" ? { marginBottom: size * 0.08 } : {}) }}>
      {style.frame === "label-top" && <div className="w-full text-center font-bold text-white" style={{ background: style.frameColor, margin: -pad, marginBottom: pad, padding: `${size * 0.03}px 0`, fontSize: size * 0.075, borderRadius: `${pad}px ${pad}px 0 0` }}>{style.frameText}</div>}
      <div ref={ref} style={{ width: size, height: size, lineHeight: 0 }} />
      {style.frame === "label-bottom" && <div className="w-full text-center font-bold text-white" style={{ background: style.frameColor, margin: -pad, marginTop: pad, padding: `${size * 0.03}px 0`, fontSize: size * 0.075, borderRadius: `0 0 ${pad}px ${pad}px` }}>{style.frameText}</div>}
      {style.frame === "badge" && <div className="absolute left-1/2 -translate-x-1/2 text-white font-bold whitespace-nowrap" style={{ bottom: -size * 0.07, background: style.frameColor, padding: `${size * 0.02}px ${size * 0.06}px`, borderRadius: 999, fontSize: size * 0.07 }}>{style.frameText}</div>}
    </div>
  );
}

/** Downloads the current preview via qr-code-styling (client-only; no frame). */
export async function downloadClientQr(data: string, style: QrStyle, name: string, ext: "png" | "svg") {
  const mod = await import("qr-code-styling");
  const qr = new mod.default({ ...qrStylingOptions(data, { ...style, size: ext === "png" ? 1000 : style.size }), type: ext === "svg" ? "svg" : "canvas" });
  await qr.download({ name, extension: ext });
}

const DOTS: { v: QrDotType; l: string }[] = [{ v: "square", l: "Square" }, { v: "rounded", l: "Rounded" }, { v: "dots", l: "Dots" }, { v: "classy", l: "Classy" }, { v: "classy-rounded", l: "Classy rounded" }, { v: "extra-rounded", l: "Extra rounded" }];
const CORNERS: { v: QrCornerSquareType; l: string }[] = [{ v: "square", l: "Square" }, { v: "extra-rounded", l: "Rounded" }, { v: "dot", l: "Dot" }];
const CDOTS: { v: QrCornerDotType; l: string }[] = [{ v: "square", l: "Square" }, { v: "dot", l: "Dot" }];
const FRAMES: { v: QrFrameType; l: string }[] = [{ v: "none", l: "None" }, { v: "simple", l: "Border" }, { v: "label-bottom", l: "Label bottom" }, { v: "label-top", l: "Label top" }, { v: "badge", l: "Badge" }];

function Seg<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-1">{options.map((o) => <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)} className={cn("px-2.5 py-1 text-xs rounded-lg border disabled:opacity-50", value === o.v ? "border-primary bg-primary/10 text-primary" : "border-border")}>{o.l}</button>)}</div>
    </div>
  );
}

function Color({ label, value, onChange, allowTransparent }: { label: string; value: string; onChange: (v: string) => void; allowTransparent?: boolean }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" className="h-9 w-12 rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
        {allowTransparent && <button type="button" className={cn("btn-secondary btn-sm whitespace-nowrap", value === "transparent" && "border-primary text-primary")} onClick={() => onChange(value === "transparent" ? "#ffffff" : "transparent")}>None</button>}
      </div>
    </div>
  );
}

export function QrStyleEditor({ style, onChange, advanced, defaultLogo, basic }: { style: QrStyle; onChange: (s: QrStyle) => void; advanced: boolean; defaultLogo?: string; basic?: boolean }) {
  const set = (patch: Partial<QrStyle>) => onChange({ ...style, ...patch, template: "custom" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const locked = !advanced;
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Templates</label>
        <div className="grid grid-cols-4 gap-2">
          {QR_STYLE_TEMPLATES.map((t) => {
            const isLocked = locked && (t.style.dots !== "square" || t.style.frame !== "none" || t.style.gradient);
            return (
              <button key={t.key} type="button" disabled={!!isLocked} onClick={() => onChange({ ...style, ...t.style, template: t.key })} className={cn("rounded-lg border p-1.5 text-center disabled:opacity-40", style.template === t.key ? "border-primary ring-2 ring-primary/30" : "border-border")}>
                <div className="aspect-square rounded-md grid place-items-center" style={{ background: t.style.bg ?? "#fff" }}><div className="h-3/4 w-3/4 rounded-sm" style={{ background: t.style.gradient ? `linear-gradient(45deg,${t.style.gradient.from},${t.style.gradient.to})` : t.style.color, borderRadius: t.style.dots === "dots" ? "50%" : t.style.dots?.includes("rounded") ? 6 : 2 }} /></div>
                <span className="text-[10px] block mt-1 truncate">{t.label}{isLocked && <Lock size={9} className="inline ml-0.5" />}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Color label="Foreground" value={style.color} onChange={(v) => set({ color: v })} />
        <Color label="Background" value={style.bg} onChange={(v) => set({ bg: v })} allowTransparent />
      </div>
      {!basic && (
        <>
          <div className={cn(locked && "opacity-60")}>
            <div className="flex items-center justify-between"><label className="label">Gradient {locked && <Lock size={11} className="inline" />}</label><label className="text-xs flex items-center gap-1"><input type="checkbox" disabled={locked} checked={!!style.gradient} onChange={(e) => set({ gradient: e.target.checked ? { type: "linear", rotation: 45, from: style.color, to: "#6366f1" } : null })} />Enable</label></div>
            {style.gradient && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Color label="From" value={style.gradient.from} onChange={(v) => set({ gradient: { ...style.gradient!, from: v } })} />
                <Color label="To" value={style.gradient.to} onChange={(v) => set({ gradient: { ...style.gradient!, to: v } })} />
                <select className="input" value={style.gradient.type} onChange={(e) => set({ gradient: { ...style.gradient!, type: e.target.value === "radial" ? "radial" : "linear" } })}><option value="linear">Linear</option><option value="radial">Radial</option></select>
                <input type="range" min={0} max={360} value={style.gradient.rotation} onChange={(e) => set({ gradient: { ...style.gradient!, rotation: parseInt(e.target.value, 10) } })} />
              </div>
            )}
          </div>
          <Seg label={locked ? "Dot style (upgrade to unlock)" : "Dot style"} value={style.dots} options={DOTS} onChange={(v) => set({ dots: v })} disabled={locked} />
          <div className="grid grid-cols-2 gap-3">
            <Seg label="Corner squares" value={style.corners} options={CORNERS} onChange={(v) => set({ corners: v })} disabled={locked} />
            <Seg label="Corner dots" value={style.cornerDots} options={CDOTS} onChange={(v) => set({ cornerDots: v })} disabled={locked} />
          </div>
          <div className={cn(locked && "opacity-60")}>
            <label className="label">Logo {locked && <Lock size={11} className="inline" />}</label>
            <div className="flex items-center gap-2">
              {style.logo && <img src={style.logo} alt="" className="h-9 w-9 rounded border border-border object-contain bg-white" />}
              <input className="input" placeholder="Logo URL" value={style.logo ?? ""} disabled={locked} onChange={(e) => set({ logo: e.target.value || null })} />
              <button type="button" className="btn-secondary btn-sm" disabled={locked || busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}</button>
              {defaultLogo && <button type="button" className="btn-secondary btn-sm" disabled={locked} onClick={() => set({ logo: defaultLogo })}>Default</button>}
              {style.logo && <button type="button" className="btn-ghost btn-sm" onClick={() => set({ logo: null })}><X size={14} /></button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); setErr(""); try { set({ logo: await uploadFile(f, "qr") }); } catch (ex) { setErr(ex instanceof Error ? ex.message : "Upload failed"); } finally { setBusy(false); e.target.value = ""; } }} />
            </div>
            {err && <p className="hint text-danger">{err}</p>}
            {style.logo && <div className="mt-2"><label className="label text-xs">Logo size</label><input type="range" min={0.15} max={0.4} step={0.01} value={style.logoSize} disabled={locked} onChange={(e) => set({ logoSize: parseFloat(e.target.value) })} className="w-full" /></div>}
          </div>
          <div className={cn(locked && "opacity-60")}>
            <Seg label={locked ? "Frame (upgrade to unlock)" : "Frame"} value={style.frame} options={FRAMES} onChange={(v) => set({ frame: v })} disabled={locked} />
            {style.frame !== "none" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input className="input" placeholder="Frame text" value={style.frameText} maxLength={40} onChange={(e) => set({ frameText: e.target.value })} />
                <Color label="" value={style.frameColor} onChange={(v) => set({ frameColor: v })} />
              </div>
            )}
          </div>
        </>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Margin</label><input type="number" className="input" min={0} max={10} value={style.margin} onChange={(e) => set({ margin: parseInt(e.target.value, 10) || 0 })} /></div>
        <div><label className="label">Size (px)</label><input type="number" className="input" min={64} max={2000} step={10} value={style.size} onChange={(e) => set({ size: parseInt(e.target.value, 10) || 300 })} /></div>
        <div><label className="label">Error correction</label><select className="input" value={style.ecLevel} onChange={(e) => set({ ecLevel: e.target.value as QrStyle["ecLevel"] })}><option value="L">L (7%)</option><option value="M">M (15%)</option><option value="Q">Q (25%)</option><option value="H">H (30%)</option></select></div>
      </div>
    </div>
  );
}
