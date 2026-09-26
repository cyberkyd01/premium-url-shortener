"use client";
import { Trash2 } from "lucide-react";
import { Switch } from "@/components/ui";

export interface TemplateOption { id: string; name: string; params: Record<string, string> }
const UTM_KEYS: { key: string; label: string; ph: string }[] = [
  { key: "source", label: "utm_source", ph: "newsletter" }, { key: "medium", label: "utm_medium", ph: "email" }, { key: "campaign", label: "utm_campaign", ph: "spring_sale" },
  { key: "term", label: "utm_term", ph: "running+shoes" }, { key: "content", label: "utm_content", ph: "cta_button" },
];

/** Splits a saved template into UTM fields and custom key/value params. */
export function splitTemplate(params: Record<string, string>) {
  const utm: Record<string, string> = {}; const custom: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const m = k.match(/^utm_(source|medium|campaign|term|content)$/);
    if (m) utm[m[1]] = v; else if (["source", "medium", "campaign", "term", "content"].includes(k)) utm[k] = v; else custom[k] = v;
  }
  return { utm, custom };
}

export function ParamsBuilder({ utm, custom, forward, templates, allowCustom, allowTemplates, onUtm, onCustom, onForward }: {
  utm: Record<string, string>; custom: Record<string, string>; forward: boolean; templates: TemplateOption[]; allowCustom: boolean; allowTemplates: boolean;
  onUtm: (v: Record<string, string>) => void; onCustom: (v: Record<string, string>) => void; onForward: (v: boolean) => void;
}) {
  const entries = Object.entries(custom);
  const setEntry = (i: number, k: string, v: string) => { const next = entries.map((e, j) => (j === i ? [k, v] : e)); onCustom(Object.fromEntries(next.filter(([key]) => key !== undefined))); };
  return (
    <div className="space-y-4">
      {allowTemplates && templates.length > 0 && (
        <label className="label">Apply a parameter template
          <select className="input mt-1" defaultValue="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (!t) return; const s = splitTemplate(t.params); onUtm({ ...utm, ...s.utm }); onCustom({ ...custom, ...s.custom }); e.target.value = ""; }}>
            <option value="">Choose a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {UTM_KEYS.map((u) => <label key={u.key} className="label">{u.label}<input className="input mt-1 font-normal" placeholder={u.ph} value={utm[u.key] ?? ""} onChange={(e) => onUtm({ ...utm, [u.key]: e.target.value })} /></label>)}
      </div>
      <div>
        <p className="label">Custom parameters {!allowCustom && <span className="text-xs text-warning font-normal">(not in your plan)</span>}</p>
        <fieldset disabled={!allowCustom} className="space-y-2">
          {entries.map(([k, v], i) => (
            <div key={i} className="grid gap-2 grid-cols-[1fr_1fr_auto]">
              <input className="input" placeholder="key" value={k} onChange={(e) => setEntry(i, e.target.value, v)} />
              <input className="input" placeholder="value" value={v} onChange={(e) => setEntry(i, k, e.target.value)} />
              <button type="button" className="btn-ghost btn-sm !px-2 text-danger" onClick={() => onCustom(Object.fromEntries(entries.filter((_, j) => j !== i)))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={() => onCustom({ ...custom, [`param${entries.length + 1}`]: "" })}>+ Add parameter</button>
        </fieldset>
      </div>
      <Switch label="Forward query parameters" hint="Parameters appended to the short link (e.g. ?ref=abc) are passed through to the destination." checked={forward} onChange={onForward} />
    </div>
  );
}
