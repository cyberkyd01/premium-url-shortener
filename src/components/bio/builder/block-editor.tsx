"use client";
import { useState } from "react";
import { widgetDef, BLOCK_ANIMATIONS, BLOCK_SIZE, blockSize } from "@/lib/bio-widgets";
import type { BioBlockInput } from "@/app/dashboard/bio/actions";
import { FieldInput } from "./fields";
import { Switch } from "@/components/ui";

const LANGS = [["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"], ["it", "Italian"], ["nl", "Dutch"], ["ru", "Russian"], ["ar", "Arabic"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"], ["hi", "Hindi"], ["tr", "Turkish"], ["pl", "Polish"], ["id", "Indonesian"]];

function MultiSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || o.value.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <label className="label">{label}</label>
      {value.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{value.map((v) => <button key={v} type="button" className="badge-blue" onClick={() => onChange(value.filter((x) => x !== v))}>{options.find((o) => o.value === v)?.label ?? v} ×</button>)}</div>}
      <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <div className="max-h-32 overflow-auto border border-border rounded-lg mt-1 text-sm">{filtered.slice(0, 30).map((o) => <button key={o.value} type="button" className="block w-full text-left px-3 py-1.5 hover:bg-bg" onClick={() => { if (!value.includes(o.value)) onChange([...value, o.value]); setQ(""); }}>{o.label}</button>)}</div>}
      <p className="hint">Leave empty to show everywhere.</p>
    </div>
  );
}

function SizeControls({ content, setContent, patchContent }: { content: Record<string, unknown>; setContent: (k: string, v: unknown) => void; patchContent: (patch: Record<string, unknown>) => void }) {
  const size = blockSize(content);
  const isDefault = size.width === 100 && size.scale === 100 && size.align === "center";
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">Size</p>{!isDefault && <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => patchContent({ blockWidth: "100", blockScale: "100", blockAlign: "center" })}>Reset</button>}</div>
      <FieldInput field={BLOCK_SIZE.width} value={String(size.width)} onChange={(v) => setContent("blockWidth", v)} giphyEnabled={false} compact />
      <FieldInput field={BLOCK_SIZE.scale} value={String(size.scale)} onChange={(v) => setContent("blockScale", v)} giphyEnabled={false} compact />
      {size.width < 100 && <FieldInput field={BLOCK_SIZE.align} value={size.align} onChange={(v) => setContent("blockAlign", v)} giphyEnabled={false} compact />}
    </div>
  );
}

export function BlockEditor({ block, onChange, giphyEnabled, allowHtml, countries }: { block: BioBlockInput; onChange: (b: BioBlockInput) => void; giphyEnabled: boolean; allowHtml: boolean; countries: { code: string; name: string }[] }) {
  const def = widgetDef(block.type);
  const [tab, setTab] = useState<"content" | "settings">("content");
  if (!def) return <p className="text-sm text-danger">Unknown block type</p>;
  const set = (patch: Partial<BioBlockInput>) => onChange({ ...block, ...patch });
  const setContent = (k: string, v: unknown) => set({ content: { ...block.content, [k]: v } });
  const val = (k: string) => (k === "title" ? block.title : k === "url" ? block.url : k === "thumbnail" ? block.thumbnail : block.content[k]);
  const setVal = (k: string, v: unknown) => (k === "title" || k === "url" || k === "thumbnail" ? set({ [k]: typeof v === "string" ? v : "" }) : setContent(k, v));
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border text-sm">
        {(["content", "settings"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={"px-3 py-1.5 -mb-px border-b-2 capitalize " + (tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted")}>{t}</button>)}
      </div>
      {tab === "content" ? (
        <div className="space-y-3">
          {def.feature === "customCss" && !allowHtml && <p className="text-xs text-warning">Custom HTML requires a plan with custom code. The block will not be shown publicly.</p>}
          {def.fields.map((f) => <FieldInput key={f.key} field={f} value={val(f.key)} onChange={(v) => setVal(f.key, v)} giphyEnabled={giphyEnabled} />)}
          <SizeControls content={block.content} setContent={setContent} patchContent={(patch) => set({ content: { ...block.content, ...patch } })} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Show from</label><input type="datetime-local" className="input" value={toLocal(block.scheduleStart)} onChange={(e) => set({ scheduleStart: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            <div><label className="label">Hide after</label><input type="datetime-local" className="input" value={toLocal(block.scheduleEnd)} onChange={(e) => set({ scheduleEnd: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          </div>
          <MultiSelect label="Only show in countries" options={countries.map((c) => ({ value: c.code, label: c.name }))} value={block.countries} onChange={(v) => set({ countries: v })} />
          <MultiSelect label="Only show for languages" options={LANGS.map(([v, l]) => ({ value: v, label: l }))} value={block.languages} onChange={(v) => set({ languages: v })} />
          <Switch label="Sensitive content" hint="Visitors must click to reveal this block" checked={block.sensitive} onChange={(v) => set({ sensitive: v })} />
          <div>
            <label className="label">Gate</label>
            <select className="input" value={block.gated ?? ""} onChange={(e) => set({ gated: e.target.value || null })}>
              <option value="">None</option><option value="newsletter">Subscribe to newsletter to unlock</option><option value="password">Password</option><option value="age">Age confirmation</option>
            </select>
            {block.gated === "password" && <input className="input mt-2" placeholder="Block password" value={typeof block.content.gatePassword === "string" ? block.content.gatePassword : ""} onChange={(e) => setContent("gatePassword", e.target.value)} />}
            {block.gated === "age" && <input type="number" className="input mt-2" placeholder="Minimum age (18)" value={typeof block.content.gateAge === "string" ? block.content.gateAge : ""} onChange={(e) => setContent("gateAge", e.target.value)} />}
          </div>
          <div>
            <label className="label">Animation</label>
            <select className="input" value={block.animation ?? ""} onChange={(e) => set({ animation: e.target.value || null })}>{BLOCK_ANIMATIONS.map((a) => <option key={a} value={a}>{a ? a[0].toUpperCase() + a.slice(1) : "None"}</option>)}</select>
          </div>
        </div>
      )}
    </div>
  );
}
