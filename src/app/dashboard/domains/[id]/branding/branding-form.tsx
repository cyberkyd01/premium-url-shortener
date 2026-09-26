"use client";
import { useActionState, useState } from "react";
import { Switch } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ImageUpload } from "@/components/links/image-upload";
import { saveBranding } from "./actions";

export interface BrandingFormValues { name: string; logo: string | null; favicon: string | null; primary: string | null; accent: string | null; hideBranding: boolean; loginTitle: string }

export function BrandingForm({ id, domain, initial, siteName, disabled }: { id: string; domain: string; initial: BrandingFormValues; siteName: string; disabled?: boolean }) {
  const [state, action] = useActionState(saveBranding, null);
  const [f, setF] = useState<BrandingFormValues>(initial);
  const set = <K extends keyof BrandingFormValues>(k: K, v: BrandingFormValues[K]) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={disabled} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">Brand name</label><input name="name" className="input" placeholder={siteName} value={f.name} onChange={(e) => set("name", e.target.value)} /><p className="hint">Shown in the header, footer and page titles on {domain}.</p></div>
          <div><label className="label">Login page title</label><input name="loginTitle" className="input" placeholder="Welcome back" value={f.loginTitle} onChange={(e) => set("loginTitle", e.target.value)} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><ImageUpload value={f.logo} onChange={(v) => set("logo", v)} label="Logo" folder="branding" /><input type="hidden" name="logo" value={f.logo ?? ""} /></div>
          <div><ImageUpload value={f.favicon} onChange={(v) => set("favicon", v)} label="Favicon" folder="branding" /><input type="hidden" name="favicon" value={f.favicon ?? ""} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Primary color</label>
            <div className="flex items-center gap-2">
              <input type="color" name="primary" className="h-10 w-14 rounded-md border border-border bg-transparent" value={f.primary ?? "#6366f1"} onChange={(e) => set("primary", e.target.value)} />
              <input className="input font-mono" placeholder="#6366f1" value={f.primary ?? ""} onChange={(e) => set("primary", e.target.value || null)} />
              <input type="hidden" name="primaryClear" value={f.primary ? "0" : "1"} />
              {f.primary && <button type="button" className="btn-ghost btn-sm" onClick={() => set("primary", null)}>Reset</button>}
            </div>
          </div>
          <div>
            <label className="label">Accent color</label>
            <div className="flex items-center gap-2">
              <input type="color" name="accent" className="h-10 w-14 rounded-md border border-border bg-transparent" value={f.accent ?? "#8b5cf6"} onChange={(e) => set("accent", e.target.value)} />
              <input className="input font-mono" placeholder="#8b5cf6" value={f.accent ?? ""} onChange={(e) => set("accent", e.target.value || null)} />
              <input type="hidden" name="accentClear" value={f.accent ? "0" : "1"} />
              {f.accent && <button type="button" className="btn-ghost btn-sm" onClick={() => set("accent", null)}>Reset</button>}
            </div>
          </div>
        </div>
        <Switch name="hideBranding" label={`Hide ${siteName} branding`} hint="Removes the platform footer and product links on this domain." checked={f.hideBranding} onChange={(v) => set("hideBranding", v)} />
        <div className="rounded-lg border border-border p-4" style={{ ["--primary" as string]: f.primary ?? undefined, ["--color-primary" as string]: f.primary ?? undefined }}>
          <p className="text-xs text-muted mb-2">Preview</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold">{f.logo ? <img src={f.logo} alt="" className="h-7" /> : <span className="h-7 w-7 rounded-lg bg-primary" />}{f.name || siteName}</span>
            <span className="btn-primary btn-sm pointer-events-none">Sign up</span>
          </div>
        </div>
      </fieldset>
      <FormMessage state={state} />
      {!disabled && <SubmitButton>Save branding</SubmitButton>}
    </form>
  );
}
