"use client";
import { Trash2 } from "lucide-react";
import type { LinkPayload } from "./link-schema";
import { RowList } from "./section";
import { DEVICE_OPTIONS, LANGUAGE_OPTIONS, RULE_FIELDS, RULE_OPS, WEEKDAYS, TIMEZONES } from "./constants";

type Geo = LinkPayload["geoTargets"][number];
type Dev = LinkPayload["deviceTargets"][number];
type Lang = LinkPayload["langTargets"][number];
type Time = LinkPayload["timeTargets"][number];
type Cond = LinkPayload["conditions"][number];
type Ab = LinkPayload["abUrls"][number];

const Remove = ({ onClick }: { onClick: () => void }) => <button type="button" onClick={onClick} className="btn-ghost btn-sm !px-2 text-danger" title="Remove"><Trash2 size={14} /></button>;

export function GeoRows({ rows, onChange, countries }: { rows: Geo[]; onChange: (r: Geo[]) => void; countries: { code: string; name: string }[] }) {
  return (
    <RowList rows={rows} onChange={onChange} empty="Send visitors from specific countries to a different URL." add={() => ({ country: "US", state: "", url: "" })} addLabel="Add country"
      render={(r, set, remove) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] items-center">
          <select className="input" value={r.country} onChange={(e) => set({ country: e.target.value })}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          <input className="input" placeholder="State / region (optional)" value={r.state ?? ""} onChange={(e) => set({ state: e.target.value })} />
          <input className="input" placeholder="https://destination-for-this-country.com" value={r.url} onChange={(e) => set({ url: e.target.value })} />
          <Remove onClick={remove} />
        </div>
      )} />
  );
}

export function DeviceRows({ rows, onChange }: { rows: Dev[]; onChange: (r: Dev[]) => void }) {
  return (
    <RowList rows={rows} onChange={onChange} empty="Send mobile, tablet, desktop or specific platforms to different URLs." add={() => ({ device: "mobile", url: "" })} addLabel="Add device"
      render={(r, set, remove) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-center">
          <select className="input" value={r.device} onChange={(e) => set({ device: e.target.value })}>{DEVICE_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
          <input className="input" placeholder="https://destination-for-this-device.com" value={r.url} onChange={(e) => set({ url: e.target.value })} />
          <Remove onClick={remove} />
        </div>
      )} />
  );
}

export function LangRows({ rows, onChange }: { rows: Lang[]; onChange: (r: Lang[]) => void }) {
  return (
    <RowList rows={rows} onChange={onChange} empty="Redirect by the visitor's browser language." add={() => ({ lang: "en", url: "" })} addLabel="Add language"
      render={(r, set, remove) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-center">
          <select className="input" value={r.lang} onChange={(e) => set({ lang: e.target.value })}>{LANGUAGE_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
          <input className="input" placeholder="https://localized-destination.com" value={r.url} onChange={(e) => set({ url: e.target.value })} />
          <Remove onClick={remove} />
        </div>
      )} />
  );
}

export function TimeRows({ rows, onChange }: { rows: Time[]; onChange: (r: Time[]) => void }) {
  return (
    <RowList rows={rows} onChange={onChange} empty="Redirect during a time window (e.g. business hours)." add={() => ({ from: "09:00", to: "17:00", days: [1, 2, 3, 4, 5], timezone: "UTC", url: "" })} addLabel="Add time window"
      render={(r, set, remove) => (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto] items-center">
            <input type="time" className="input" value={r.from} onChange={(e) => set({ from: e.target.value })} />
            <input type="time" className="input" value={r.to} onChange={(e) => set({ to: e.target.value })} />
            <select className="input" value={r.timezone ?? "UTC"} onChange={(e) => set({ timezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <Remove onClick={remove} />
          </div>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map((d, i) => { const on = (r.days ?? []).includes(i); return <button key={d} type="button" onClick={() => set({ days: on ? (r.days ?? []).filter((x) => x !== i) : [...(r.days ?? []), i].sort() })} className={"btn-sm rounded-md border text-xs " + (on ? "bg-primary text-primary-fg border-primary" : "border-border text-muted")}>{d}</button>; })}
          </div>
          <input className="input" placeholder="https://destination-during-this-window.com" value={r.url} onChange={(e) => set({ url: e.target.value })} />
        </div>
      )} />
  );
}

export function RulesBuilder({ rows, onChange }: { rows: Cond[]; onChange: (r: Cond[]) => void }) {
  return (
    <RowList rows={rows} onChange={onChange} empty="Combine multiple conditions (country + device + referrer…) into one rule group." add={(): Cond => ({ match: "all", rules: [{ field: "country", op: "eq", value: "" }], url: "" })} addLabel="Add rule group"
      render={(g, set, remove) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span>Redirect when</span>
            <select className="input !w-auto" value={g.match} onChange={(e) => set({ match: e.target.value as "all" | "any" })}><option value="all">all</option><option value="any">any</option></select>
            <span>of these match:</span>
            <span className="flex-1" /><Remove onClick={remove} />
          </div>
          {g.rules.map((rule, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1.4fr_auto] items-center">
              <select className="input" value={rule.field.startsWith("param:") ? "param:" : rule.field} onChange={(e) => set({ rules: g.rules.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })}>{RULE_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
              {rule.field.startsWith("param:") ? <input className="input" placeholder="param:name" value={rule.field} onChange={(e) => set({ rules: g.rules.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)) })} /> : <select className="input" value={rule.op} onChange={(e) => set({ rules: g.rules.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)) })}>{RULE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
              <input className="input" placeholder="Value" value={rule.value} onChange={(e) => set({ rules: g.rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <Remove onClick={() => set({ rules: g.rules.filter((_, j) => j !== i) })} />
            </div>
          ))}
          {g.rules.some((r) => r.field.startsWith("param:")) && <p className="hint">For query parameter rules pick an operator by editing the field as <code>param:name</code>; the operator defaults to equals.</p>}
          <button type="button" className="btn-ghost btn-sm" onClick={() => set({ rules: [...g.rules, { field: "device", op: "eq", value: "" }] })}>+ Add condition</button>
          <input className="input" placeholder="https://destination-when-matched.com" value={g.url} onChange={(e) => set({ url: e.target.value })} />
        </div>
      )} />
  );
}

export function AbRows({ rows, onChange, mode, onMode }: { rows: Ab[]; onChange: (r: Ab[]) => void; mode: string; onMode: (m: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="label">Mode
          <select className="input mt-1" value={mode === "none" ? "ab" : mode} onChange={(e) => onMode(e.target.value)}>
            <option value="ab">A/B split (weighted random)</option>
            <option value="rotate">Rotate (sequential)</option>
            <option value="random">Random (equal)</option>
          </select>
        </label>
      </div>
      <RowList rows={rows} onChange={onChange} empty="Add alternative destinations. The main URL is variant A." add={() => ({ url: "", weight: 1 })} addLabel="Add variant"
        render={(r, set, remove, i) => (
          <div className="grid gap-2 sm:grid-cols-[auto_2fr_1fr_auto] items-center">
            <span className="badge-blue">Variant {String.fromCharCode(66 + i)}</span>
            <input className="input" placeholder="https://variant-url.com" value={r.url} onChange={(e) => set({ url: e.target.value })} />
            <input type="number" min={1} className="input" placeholder="Weight" value={r.weight ?? 1} onChange={(e) => set({ weight: parseInt(e.target.value, 10) || 1 })} />
            <Remove onClick={remove} />
          </div>
        )} />
    </div>
  );
}
