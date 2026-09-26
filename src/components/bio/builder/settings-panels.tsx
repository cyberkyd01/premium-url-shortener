"use client";
import { Trash2, Lock } from "lucide-react";
import Link from "next/link";
import { Switch } from "@/components/ui";
import { BIO_THEMES, BIO_FONTS, BIO_LAYOUTS, BIO_BUTTON_STYLES, SOCIAL_ICON_STYLES, SOCIAL_NETWORKS, type BioColors, type BioSocial } from "@/lib/bio-widgets";
import type { BioPageInput } from "@/app/dashboard/bio/actions";
import { UploadInput } from "./fields";

export interface BuilderOptions {
  domains: { id: string; domain: string }[]; channels: { id: string; name: string }[]; pixels: { id: string; name: string; provider: string }[];
  features: { customCss: boolean; customLogo: boolean; noBranding: boolean; bioCustomDomain: boolean; pixels: boolean }; isAdmin: boolean; giphyEnabled: boolean; baseHost: string; mainDomainAllowed: boolean;
}
type PanelProps = { page: BioPageInput; set: (patch: Partial<BioPageInput>) => void; options: BuilderOptions };

function Locked({ label }: { label: string }) {
  return <p className="text-xs text-muted flex items-center gap-1"><Lock size={12} />{label} is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link></p>;
}

export function ProfilePanel({ page, set, options }: PanelProps) {
  const custom = options.features.bioCustomDomain || options.isAdmin;
  return (
    <div className="space-y-3">
      <div><label className="label">Name</label><input className="input" value={page.name} onChange={(e) => set({ name: e.target.value })} placeholder="Your name or brand" /></div>
      <div><label className="label">Bio</label><textarea className="input min-h-20" value={page.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="A short description" /></div>
      <UploadInput label="Avatar" value={page.avatar} onChange={(v) => set({ avatar: v })} folder="bio" />
      <UploadInput label="Cover image" value={page.cover} onChange={(v) => set({ cover: v })} folder="bio" />
      <div>
        <label className="label">Page URL</label>
        <div className="flex gap-2">
          <select className="input w-auto max-w-[50%]" value={page.domainId ?? ""} onChange={(e) => set({ domainId: e.target.value || null })} disabled={!custom && !page.domainId}>
            {(options.mainDomainAllowed || !page.domainId) && <option value="">{options.baseHost}/</option>}
            {options.domains.map((d) => <option key={d.id} value={d.id}>{d.domain}/</option>)}
          </select>
          <input className="input" value={page.alias} onChange={(e) => set({ alias: e.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })} placeholder="alias" />
        </div>
        {!custom && <Locked label="Custom domains for bio pages" />}
      </div>
      <div><label className="label">Channel</label><select className="input" value={page.channelId ?? ""} onChange={(e) => set({ channelId: e.target.value || null })}><option value="">None</option>{options.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label">Contact email for form submissions</label><input type="email" className="input" value={page.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="Defaults to your account email" /></div>
      <Switch label="Page enabled" checked={page.status === "active"} onChange={(v) => set({ status: v ? "active" : "disabled" })} />
    </div>
  );
}

const colorKeys: { key: keyof BioColors; label: string }[] = [{ key: "bg", label: "Background" }, { key: "text", label: "Text" }, { key: "button", label: "Button" }, { key: "buttonText", label: "Button text" }];

export function AppearancePanel({ page, set, options }: PanelProps) {
  const setColor = (k: keyof BioColors, v: string) => set({ colors: { ...page.colors, [k]: v } });
  const f = options.features, admin = options.isAdmin;
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Theme</label>
        <div className="grid grid-cols-4 gap-2">
          {BIO_THEMES.map((t) => <button key={t.key} type="button" title={t.label} onClick={() => set({ theme: t.key, colors: t.key === "custom" ? page.colors : {} })} className={"rounded-lg border-2 p-1 " + (page.theme === t.key ? "border-primary" : "border-transparent")}><div className="h-10 rounded-md border border-border" style={{ background: t.preview }} /><span className="block text-[10px] mt-1 truncate text-center">{t.label}</span></button>)}
        </div>
      </div>
      <div>
        <label className="label">Custom colors {page.theme !== "custom" && <span className="text-muted font-normal">(override theme)</span>}</label>
        <div className="grid grid-cols-2 gap-2">
          {colorKeys.map((c) => <div key={c.key} className="flex items-center gap-2"><input type="color" className="h-8 w-10 rounded border border-border bg-transparent" value={/^#[0-9a-fA-F]{6}$/.test(page.colors[c.key] ?? "") ? page.colors[c.key] : "#000000"} onChange={(e) => setColor(c.key, e.target.value)} /><span className="text-xs flex-1">{c.label}</span>{page.colors[c.key] && <button type="button" className="text-xs text-muted" onClick={() => setColor(c.key, "")}>×</button>}</div>)}
        </div>
        <input className="input mt-2" placeholder="Background gradient CSS e.g. linear-gradient(135deg,#f43f5e,#f59e0b)" value={page.colors.bgGradient ?? ""} onChange={(e) => setColor("bgGradient", e.target.value)} />
        <select className="input mt-2" value={page.colors.animation ?? ""} onChange={(e) => set({ colors: { ...page.colors, animation: e.target.value as BioColors["animation"] } })}><option value="">No background animation</option><option value="gradient">Animated gradient</option><option value="particles">Particles</option></select>
      </div>
      <div><label className="label">Font</label><select className="input" value={page.font} onChange={(e) => set({ font: e.target.value })}>{BIO_FONTS.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
      <div><label className="label">Layout</label><div className="grid grid-cols-5 gap-1">{BIO_LAYOUTS.map((l) => <button key={l.key} type="button" onClick={() => set({ layout: l.key })} className={"text-xs rounded-lg border px-1 py-2 " + (page.layout === l.key ? "border-primary bg-primary/10 text-primary" : "border-border")}>{l.label}</button>)}</div></div>
      <div><label className="label">Button style</label><div className="grid grid-cols-4 gap-1">{BIO_BUTTON_STYLES.map((b) => <button key={b.key} type="button" onClick={() => set({ buttonStyle: b.key })} className={"text-xs rounded-lg border px-1 py-2 " + (page.buttonStyle === b.key ? "border-primary bg-primary/10 text-primary" : "border-border")}>{b.label}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Social icon style</label><select className="input" value={page.socialIconStyle} onChange={(e) => set({ socialIconStyle: e.target.value })}>{SOCIAL_ICON_STYLES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></div>
        <div><label className="label">Social icon position</label><select className="input" value={page.socialsPosition} onChange={(e) => set({ socialsPosition: e.target.value })}><option value="bottom">Below links</option><option value="top">Under profile</option></select></div>
      </div>
      <div>{f.customLogo || admin ? <UploadInput label="Custom logo (shown on top)" value={page.customLogo} onChange={(v) => set({ customLogo: v })} /> : <Locked label="Custom logo" />}</div>
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium mb-2">Footer</p>
        {f.noBranding || admin ? <Switch label='Show "Made with" branding' hint="Turn off to remove the footer link from this page" checked={!page.hideBranding} onChange={(v) => set({ hideBranding: !v })} /> : <Locked label="Removing branding" />}
      </div>
      <div className="rounded-lg border border-border p-3 space-y-3">
        <p className="text-sm font-medium">Custom code</p>
        <div>
          <label className="label">Custom CSS</label>
          {f.customCss || admin ? <textarea className="input min-h-24 font-mono text-xs" value={page.customCss} onChange={(e) => set({ customCss: e.target.value })} placeholder=".bio-btn { letter-spacing: .05em }" /> : <Locked label="Custom CSS" />}
        </div>
        <div>
          <label className="label">Custom JavaScript</label>
          {f.customCss || admin ? <><textarea className="input min-h-24 font-mono text-xs" value={page.customJs} onChange={(e) => set({ customJs: e.target.value })} placeholder={"document.querySelectorAll('.bio-btn').forEach(b => b.addEventListener('click', () => console.log('clicked', b.textContent)));"} spellCheck={false} /><p className="hint">Runs on the live page only (not in this preview), after the page loads. Paste plain JavaScript without &lt;script&gt; tags.</p></> : <Locked label="Custom JavaScript" />}
        </div>
      </div>
    </div>
  );
}

export function SocialsPanel({ page, set }: PanelProps) {
  const socials = page.socials;
  const update = (list: BioSocial[]) => set({ socials: list.map((s, i) => ({ ...s, order: i })) });
  const used = new Set(socials.map((s) => s.network));
  return (
    <div className="space-y-3">
      {socials.map((s, i) => {
        const net = SOCIAL_NETWORKS.find((n) => n.key === s.network);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-24 text-sm truncate">{net?.label ?? s.network}</span>
            <input className="input" value={s.url} placeholder={net?.prefix} onChange={(e) => update(socials.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => { const a = [...socials]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; update(a); }}>↑</button>
            <button type="button" className="btn-ghost btn-sm" disabled={i === socials.length - 1} onClick={() => { const a = [...socials]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; update(a); }}>↓</button>
            <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => update(socials.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        );
      })}
      <select className="input" value="" onChange={(e) => { const n = SOCIAL_NETWORKS.find((x) => x.key === e.target.value); if (n) update([...socials, { network: n.key, url: n.prefix ?? "" }]); }}>
        <option value="">+ Add network…</option>
        {SOCIAL_NETWORKS.filter((n) => !used.has(n.key)).map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
      </select>
    </div>
  );
}

export function SeoPanel({ page, set }: PanelProps) {
  return (
    <div className="space-y-3">
      <div><label className="label">Meta title</label><input className="input" value={page.seo.title ?? ""} onChange={(e) => set({ seo: { ...page.seo, title: e.target.value } })} placeholder={page.name || "Page title"} /></div>
      <div><label className="label">Meta description</label><textarea className="input min-h-20" value={page.seo.description ?? ""} onChange={(e) => set({ seo: { ...page.seo, description: e.target.value } })} /></div>
      <UploadInput label="Social share image" value={page.seo.image ?? ""} onChange={(v) => set({ seo: { ...page.seo, image: v } })} />
      <Switch label="Hide from search engines (noindex)" checked={!!page.seo.noindex} onChange={(v) => set({ seo: { ...page.seo, noindex: v }, ...(v ? { listed: false } : {}) })} />
      <Switch label="List in public directory" hint="Show this page on the public bio pages directory (/bio-pages). Not available together with noindex." checked={!!page.listed} disabled={!!page.seo.noindex} onChange={(v) => set({ listed: v })} />
    </div>
  );
}

export function AccessPanel({ page, set }: PanelProps) {
  return (
    <div className="space-y-3">
      <div><label className="label">Password</label><input className="input" value={page.password} onChange={(e) => set({ password: e.target.value })} placeholder="Leave empty for no password" /></div>
      <div><label className="label">Age gate (minimum age)</label><input type="number" className="input" min={1} max={99} value={page.ageGate ?? ""} onChange={(e) => set({ ageGate: e.target.value ? parseInt(e.target.value, 10) : null })} placeholder="e.g. 18" /></div>
      <Switch label="Sensitive content warning" hint="Visitors must confirm before viewing" checked={page.sensitive} onChange={(v) => set({ sensitive: v })} />
      <Switch label="NSFW warning" checked={page.nsfwWarning} onChange={(v) => set({ nsfwWarning: v })} />
      <Switch label="Newsletter gate" hint="Visitors must subscribe with their email to view the page" checked={page.newsletterGate} onChange={(v) => set({ newsletterGate: v })} />
    </div>
  );
}

export function PixelsPanel({ page, set, options }: PanelProps) {
  if (!options.features.pixels && !options.isAdmin) return <Locked label="Retargeting pixels" />;
  if (!options.pixels.length) return <p className="text-sm text-muted">No pixels yet. <Link href="/dashboard/pixels" className="underline">Create a pixel</Link> first.</p>;
  return (
    <div className="space-y-2">
      {options.pixels.map((p) => (
        <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={page.pixelIds.includes(p.id)} onChange={(e) => set({ pixelIds: e.target.checked ? [...page.pixelIds, p.id] : page.pixelIds.filter((x) => x !== p.id) })} />{p.name} <span className="text-xs text-muted">({p.provider})</span></label>
      ))}
    </div>
  );
}
