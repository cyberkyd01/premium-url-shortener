"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import type { PlanFeatures } from "@/lib/plan";
import { detectDeepLink } from "@/lib/deeplinks";
import { cn } from "@/lib/utils";
import { Switch, CopyButton } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { saveLink } from "@/app/dashboard/links/actions";
import type { LinkPayload } from "./link-schema";
import { Section } from "./section";
import { AliasField } from "./alias-field";
import { ImageUpload } from "./image-upload";
import { ParamsBuilder, type TemplateOption } from "./params-builder";
import { GeoRows, DeviceRows, LangRows, TimeRows, RulesBuilder, AbRows } from "./targeting";
import { REDIRECT_TYPES } from "./constants";
import { TagsInput } from "./tags-input";

export interface LinkFormOptions {
  domains: { id: string; domain: string; isPublic: boolean }[];
  splashPages: { id: string; name: string }[];
  overlays: { id: string; name: string }[];
  channels: { id: string; name: string; color: string }[];
  campaigns: { id: string; name: string }[];
  pixels: { id: string; name: string; provider: string }[];
  templates: TemplateOption[];
  countries: { code: string; name: string }[];
  /** Existing tags in the workspace (suggestions). */
  tags?: string[];
  features: PlanFeatures;
  isAdmin: boolean;
  aiEnabled: boolean;
  mainUsable: boolean;
  appHost: string;
  hasPassword?: boolean;
}

const DEFAULTS: LinkPayload = {
  url: "", alias: "", domainId: null, title: null, description: null, image: null, redirectType: "direct", splashId: null, overlayId: null,
  password: "", clearPassword: false, expiresAt: null, expiredUrl: null, clickLimit: null, clickLimitUrl: null, channelId: null, campaignId: null,
  pixelIds: [], utm: {}, customParams: {}, forwardParams: false, geoTargets: [], deviceTargets: [], langTargets: [], timeTargets: [], conditions: [],
  abUrls: [], rotatorMode: "none", deepLink: false, deepLinkConfig: {}, cloaking: false, botBlock: false, inAppBreakout: false, isPublic: true, notes: null,
  tags: [], activateAt: null, blockCountries: [], blockIps: "", fallbackUrl: null, alertThreshold: null,
};

export function LinkForm({ options: o, initial, id }: { options: LinkFormOptions; initial?: Partial<LinkPayload>; id?: string }) {
  const [f, setF] = useState<LinkPayload>({ ...DEFAULTS, ...initial });
  const set = <K extends keyof LinkPayload>(k: K, v: LinkPayload[K]) => setF((s) => ({ ...s, [k]: v }));
  const [state, formAction] = useActionState(saveLink, null);
  const router = useRouter();
  const locked = (k: keyof PlanFeatures) => !o.isAdmin && !o.features[k];
  const typeAllowed = (t: string) => o.isAdmin || o.features.redirectTypes.includes(t);
  const prefix = useMemo(() => { const d = o.domains.find((x) => x.id === f.domainId); return d ? d.domain : o.appHost; }, [f.domainId, o.domains, o.appHost]);
  const auto = useMemo(() => (f.url ? detectDeepLink(/^[a-z]+:/i.test(f.url) ? f.url : "https://" + f.url) : null), [f.url]);
  const created = state?.ok && !id ? (state.data as { id: string; short: string; status?: string }) : null;
  useEffect(() => { if (state?.ok && id) router.refresh(); }, [state, id, router]);
  const count = (n: number) => (n ? <span className="badge-blue">{n}</span> : null);

  if (created) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto">
        <CheckCircle2 size={36} className="mx-auto text-success mb-3" />
        <h2 className="text-xl font-bold">{created.status === "pending" ? "Link created, awaiting approval" : "Your link is ready"}</h2>
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap"><a href={created.short} target="_blank" rel="noreferrer" className="text-primary font-medium text-lg break-all">{created.short}</a><CopyButton text={created.short} /></div>
        <div className="mt-6 flex justify-center gap-2 flex-wrap">
          <Link href={`/dashboard/links/${created.id}`} className="btn-primary">View stats</Link>
          <Link href={`/dashboard/links/${created.id}/edit`} className="btn-secondary">Edit link</Link>
          <Link href={`/dashboard/qr/new?linkId=${created.id}`} className="btn-secondary">Create QR code</Link>
          <button type="button" className="btn-ghost" onClick={() => { setF({ ...DEFAULTS, domainId: f.domainId }); router.refresh(); }}>Shorten another</button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="payload" value={JSON.stringify(f)} />

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Destination URL</label>
          <input className="input" placeholder="https://example.com/very/long/url" value={f.url} onChange={(e) => set("url", e.target.value)} required autoFocus={!id} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Domain</label>
            <select className="input" value={f.domainId ?? ""} disabled={!!id} onChange={(e) => set("domainId", e.target.value || null)}>
              {(o.mainUsable || o.isAdmin || !o.domains.length) && <option value="">{o.appHost}</option>}
              {o.domains.map((d) => <option key={d.id} value={d.id}>{d.domain}{d.isPublic ? " (public)" : ""}</option>)}
            </select>
            {id && <p className="hint">The domain cannot be changed after creation.</p>}
          </div>
          <AliasField value={f.alias} onChange={(v) => set("alias", v)} domainId={f.domainId} excludeId={id} prefix={prefix} aiEnabled={o.aiEnabled} url={f.url} title={f.title ?? ""} disabled={locked("customAlias")} hint={locked("customAlias") ? "Custom aliases are not included in your plan." : undefined} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Title</label><input className="input" placeholder="Optional title" value={f.title ?? ""} onChange={(e) => set("title", e.target.value || null)} /></div>
          <div><label className="label">Description</label><input className="input" placeholder="Optional description" value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></div>
        </div>
        <div>
          <ImageUpload value={f.image} onChange={(v) => set("image", v)} label="Meta image (social preview)" disabled={locked("metaTags")} />
          {locked("metaTags") && <p className="hint text-warning flex items-center gap-1"><Lock size={11} /> Custom meta tags require an upgrade.</p>}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Redirection type</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {REDIRECT_TYPES.map((t) => { const ok = typeAllowed(t.value); return (
            <button type="button" key={t.value} disabled={!ok} onClick={() => set("redirectType", t.value)} className={cn("text-left rounded-lg border p-3 transition", f.redirectType === t.value ? "border-primary bg-primary/5" : "border-border hover:bg-bg", !ok && "opacity-50 cursor-not-allowed")}>
              <p className="text-sm font-medium flex items-center gap-1">{t.label}{!ok && <Lock size={11} className="text-warning" />}</p><p className="text-xs text-muted">{t.hint}</p>
            </button>); })}
        </div>
        {f.redirectType === "custom" && (
          <div><label className="label">Splash page</label>
            <select className="input" value={f.splashId ?? ""} onChange={(e) => set("splashId", e.target.value || null)}><option value="">Choose a splash page…</option>{o.splashPages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <p className="hint">Design splash pages under <Link href="/dashboard/splash" className="text-primary">Splash Pages</Link>.</p></div>
        )}
        {f.redirectType === "overlay" && (
          <div><label className="label">Overlay</label>
            <select className="input" value={f.overlayId ?? ""} onChange={(e) => set("overlayId", e.target.value || null)}><option value="">Choose an overlay…</option>{o.overlays.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <p className="hint">Create overlays under <Link href="/dashboard/overlays" className="text-primary">Overlays</Link>.</p></div>
        )}
      </div>

      <Section title="Organize" description="Tags, channel, campaign, pixels, visibility and notes" defaultOpen={!!(f.channelId || f.campaignId || f.pixelIds.length || f.tags.length)}>
        <div><label className="label">Tags</label><TagsInput value={f.tags} onChange={(v) => set("tags", v)} suggestions={o.tags ?? []} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Channel</label><select className="input" value={f.channelId ?? ""} onChange={(e) => set("channelId", e.target.value || null)}><option value="">None</option>{o.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">Campaign</label><select className="input" value={f.campaignId ?? ""} onChange={(e) => set("campaignId", e.target.value || null)}><option value="">None</option>{o.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div>
          <p className="label flex items-center gap-1">Retargeting pixels {locked("pixels") && <Lock size={11} className="text-warning" />}</p>
          {o.pixels.length === 0 ? <p className="hint">No pixels yet. <Link href="/dashboard/pixels" className="text-primary">Add pixels</Link>.</p> : (
            <div className="flex flex-wrap gap-2">
              {o.pixels.map((p) => { const on = f.pixelIds.includes(p.id); return <label key={p.id} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer", on ? "border-primary bg-primary/5" : "border-border", locked("pixels") && "opacity-50")}><input type="checkbox" className="accent-primary" disabled={locked("pixels")} checked={on} onChange={(e) => set("pixelIds", e.target.checked ? [...f.pixelIds, p.id] : f.pixelIds.filter((x) => x !== p.id))} />{p.name} <span className="text-xs text-muted">{p.provider}</span></label>; })}
            </div>
          )}
        </div>
        <Switch label="Public statistics" hint="Anyone with the link can view stats by appending + to the short URL." checked={f.isPublic} onChange={(v) => set("isPublic", v)} disabled={locked("publicStats")} />
        <div><label className="label">Notes</label><textarea className="input min-h-20" placeholder="Private notes about this link" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></div>
      </Section>

      <Section title="Password, expiration & click limit" description="Protect, schedule and limit access to the link" defaultOpen={!!(o.hasPassword || f.expiresAt || f.clickLimit || f.activateAt || f.fallbackUrl || f.alertThreshold)}>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label flex items-center gap-1">Password {locked("password") && <Lock size={11} className="text-warning" />}</label>
            <input type="password" className="input" placeholder={o.hasPassword ? "•••••• (unchanged)" : "Optional"} value={f.password} disabled={locked("password")} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            {o.hasPassword && <label className="hint flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={f.clearPassword} onChange={(e) => set("clearPassword", e.target.checked)} /> Remove password</label>}
          </div>
          <div>
            <label className="label flex items-center gap-1">Expires at {locked("expiration") && <Lock size={11} className="text-warning" />}</label>
            <input type="datetime-local" className="input" value={f.expiresAt ?? ""} disabled={locked("expiration")} onChange={(e) => set("expiresAt", e.target.value || null)} />
            <input className="input mt-2" placeholder="Redirect after expiry (optional URL)" value={f.expiredUrl ?? ""} disabled={locked("expiration")} onChange={(e) => set("expiredUrl", e.target.value || null)} />
          </div>
          <div>
            <label className="label flex items-center gap-1">Click limit {locked("clickLimit") && <Lock size={11} className="text-warning" />}</label>
            <input type="number" min={1} className="input" placeholder="Unlimited" value={f.clickLimit ?? ""} disabled={locked("clickLimit")} onChange={(e) => set("clickLimit", e.target.value ? parseInt(e.target.value, 10) : null)} />
            <input className="input mt-2" placeholder="Redirect after limit (optional URL)" value={f.clickLimitUrl ?? ""} disabled={locked("clickLimit")} onChange={(e) => set("clickLimitUrl", e.target.value || null)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label flex items-center gap-1">Activate at {locked("expiration") && <Lock size={11} className="text-warning" />}</label>
            <input type="datetime-local" className="input" value={f.activateAt ?? ""} disabled={locked("expiration")} onChange={(e) => set("activateAt", e.target.value || null)} />
            <p className="hint">Visitors see a &quot;coming soon&quot; page until this date.</p>
          </div>
          <div>
            <label className="label">Fallback URL if destination is down</label>
            <input className="input" placeholder="https://backup-destination.com" value={f.fallbackUrl ?? ""} onChange={(e) => set("fallbackUrl", e.target.value || null)} />
            <p className="hint">Used automatically when the health checker marks the destination as broken.</p>
          </div>
          <div>
            <label className="label">Alert me when clicks reach</label>
            <input type="number" min={1} className="input" placeholder="e.g. 1000" value={f.alertThreshold ?? ""} onChange={(e) => set("alertThreshold", e.target.value ? parseInt(e.target.value, 10) : null)} />
            <p className="hint">You get a notification (and email) once.</p>
          </div>
        </div>
      </Section>

      <Section title="Blocklists" description="Deny access from specific countries or IP addresses" locked={locked("conditions")} badge={count(f.blockCountries.length + (f.blockIps.trim() ? 1 : 0))}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Block countries</label>
            <select multiple className="input min-h-40" value={f.blockCountries} onChange={(e) => set("blockCountries", Array.from(e.target.selectedOptions).map((x) => x.value))}>
              {o.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <p className="hint">Hold Ctrl/Cmd to select several. {f.blockCountries.length > 0 && <button type="button" className="text-primary" onClick={() => set("blockCountries", [])}>Clear</button>}</p>
          </div>
          <div>
            <label className="label">Block IPs</label>
            <textarea className="input min-h-40 font-mono text-xs" placeholder={"203.0.113.7\n198.51.100.0/24\n10.0."} value={f.blockIps} onChange={(e) => set("blockIps", e.target.value)} />
            <p className="hint">One per line: exact IP, IPv4 CIDR (x.x.x.x/24) or a prefix ending with a dot.</p>
          </div>
        </div>
      </Section>

      <Section title="UTM & parameters" description="Append tracking parameters to the destination" locked={locked("utm")} badge={count(Object.values(f.utm).filter(Boolean).length + Object.keys(f.customParams).length)}>
        <ParamsBuilder utm={f.utm} custom={f.customParams} forward={f.forwardParams} templates={o.templates} allowCustom={!locked("customParams")} allowTemplates={!locked("parameterTemplates")} onUtm={(v) => set("utm", v)} onCustom={(v) => set("customParams", v)} onForward={(v) => set("forwardParams", v)} />
      </Section>

      <Section title="Geo targeting" description="Different destinations per country / state" locked={locked("geoTargeting")} badge={count(f.geoTargets.length)}>
        <GeoRows rows={f.geoTargets} onChange={(v) => set("geoTargets", v)} countries={o.countries} />
      </Section>
      <Section title="Device targeting" description="Route by device type or platform" locked={locked("deviceTargeting")} badge={count(f.deviceTargets.length)}>
        <DeviceRows rows={f.deviceTargets} onChange={(v) => set("deviceTargets", v)} />
      </Section>
      <Section title="Language targeting" description="Route by browser language" locked={locked("languageTargeting")} badge={count(f.langTargets.length)}>
        <LangRows rows={f.langTargets} onChange={(v) => set("langTargets", v)} />
      </Section>
      <Section title="Time targeting" description="Route by time of day and weekday" locked={locked("timeTargeting")} badge={count(f.timeTargets.length)}>
        <TimeRows rows={f.timeTargets} onChange={(v) => set("timeTargets", v)} />
      </Section>
      <Section title="Advanced rules" description="Multi-condition rule groups (evaluated first)" locked={locked("conditions")} badge={count(f.conditions.length)}>
        <RulesBuilder rows={f.conditions} onChange={(v) => set("conditions", v)} />
      </Section>
      <Section title="A/B testing & rotation" description="Split traffic between several destinations" locked={locked("abTesting")} badge={count(f.abUrls.length)}>
        <AbRows rows={f.abUrls} onChange={(v) => set("abUrls", v)} mode={f.rotatorMode} onMode={(m) => set("rotatorMode", m)} />
      </Section>

      <Section title="Deep linking" description="Open the destination in the native app on mobile" locked={locked("deepLinks")} defaultOpen={f.deepLink}>
        <Switch label="Enable deep linking" checked={f.deepLink} onChange={(v) => set("deepLink", v)} />
        {auto ? <p className="text-xs rounded-lg bg-success/10 text-success px-3 py-2">Auto-detected app: <b className="capitalize">{auto.app}</b> · iOS scheme <code>{auto.ios}</code></p> : <p className="hint">No known app detected for this URL. Provide a custom scheme below.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label">Custom URL scheme</label><input className="input" placeholder="myapp://path" value={f.deepLinkConfig.scheme ?? ""} onChange={(e) => set("deepLinkConfig", { ...f.deepLinkConfig, scheme: e.target.value })} /></div>
          <div><label className="label">Fallback URL</label><input className="input" placeholder="Defaults to destination" value={f.deepLinkConfig.fallback ?? ""} onChange={(e) => set("deepLinkConfig", { ...f.deepLinkConfig, fallback: e.target.value })} /></div>
          <div><label className="label">App Store link (iOS)</label><input className="input" placeholder="https://apps.apple.com/…" value={f.deepLinkConfig.ios ?? ""} onChange={(e) => set("deepLinkConfig", { ...f.deepLinkConfig, ios: e.target.value })} /></div>
          <div><label className="label">Play Store link (Android)</label><input className="input" placeholder="https://play.google.com/…" value={f.deepLinkConfig.android ?? ""} onChange={(e) => set("deepLinkConfig", { ...f.deepLinkConfig, android: e.target.value })} /></div>
        </div>
        <Switch label="Auto-detect popular apps" hint="YouTube, Instagram, TikTok, Spotify, Amazon and more." checked={f.deepLinkConfig.auto !== false} onChange={(v) => set("deepLinkConfig", { ...f.deepLinkConfig, auto: v })} />
      </Section>

      <Section title="Advanced" description="Cloaking, bot blocking, in-app browser breakout" defaultOpen={f.cloaking || f.botBlock || f.inAppBreakout}>
        <Switch label="Link cloaking" hint="Hide the referrer and serve the redirect from a 200 page." checked={f.cloaking} onChange={(v) => set("cloaking", v)} disabled={locked("cloaking")} />
        <Switch label="Block bots & crawlers" hint="Return 404 to known bots (social previews will not work)." checked={f.botBlock} onChange={(v) => set("botBlock", v)} disabled={locked("botBlock")} />
        <Switch label="In-app browser breakout" hint="Escape Instagram/Facebook/TikTok webviews into the system browser." checked={f.inAppBreakout} onChange={(v) => set("inAppBreakout", v)} disabled={locked("inAppBreakout")} />
      </Section>

      <FormMessage state={state} />
      <div className="flex items-center gap-2 sticky bottom-0 bg-bg/90 backdrop-blur py-3">
        <SubmitButton>{id ? "Save changes" : "Shorten link"}</SubmitButton>
        <Link href={id ? `/dashboard/links/${id}` : "/dashboard/links"} className="btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
