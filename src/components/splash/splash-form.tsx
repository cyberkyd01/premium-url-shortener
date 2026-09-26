"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Card, Input, Textarea, Switch, Alert, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ImageUpload } from "./image-upload";
import { SplashView, type SplashData } from "./splash-preview";
import { createSplash, updateSplash } from "@/app/dashboard/splash/actions";
import { RotateCcw } from "lucide-react";

export interface SplashFormValues extends SplashData { id?: string; name: string; isDefault: boolean }

function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
        <input className="input font-mono" name={name} value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} pattern="#[0-9a-fA-F]{6}" />
      </div>
    </div>
  );
}

export function SplashForm({ splash, allowCss, adsAllowed }: { splash?: SplashFormValues; allowCss: boolean; adsAllowed: boolean }) {
  const isEdit = !!splash?.id;
  const [state, action] = useActionState(isEdit ? updateSplash : createSplash, null);
  const [v, setV] = useState<SplashFormValues>({
    name: splash?.name ?? "", title: splash?.title ?? "", description: splash?.description ?? "", logo: splash?.logo ?? "", image: splash?.image ?? "",
    buttonText: splash?.buttonText ?? "Continue", buttonColor: splash?.buttonColor ?? "#6366f1", bgColor: splash?.bgColor ?? "#ffffff", textColor: splash?.textColor ?? "#111827",
    countdown: splash?.countdown ?? 5, showAds: splash?.showAds ?? false, adCode: splash?.adCode ?? "", customCss: splash?.customCss ?? "", customHtml: splash?.customHtml ?? "", isDefault: splash?.isDefault ?? false,
  });
  const set = <K extends keyof SplashFormValues>(k: K, val: SplashFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const [previewKey, setPreviewKey] = useState(0);
  return (
    <form action={action} className="grid lg:grid-cols-5 gap-6 items-start">
      {splash?.id && <input type="hidden" name="id" value={splash.id} />}
      <div className="lg:col-span-3 space-y-6">
        <Card title="General">
          <div className="space-y-4">
            <Input label="Name" name="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} hint="Internal name shown when choosing a splash page for a link." />
            <Input label="Title" name="title" value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="Thanks for visiting!" />
            <Textarea label="Description" name="description" value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={2000} placeholder="A short message shown before the redirect." />
            <div className="grid sm:grid-cols-2 gap-4">
              <ImageUpload label="Logo" name="logo" value={v.logo ?? ""} onChange={(u) => set("logo", u)} hint="PNG/SVG, shown above the title." />
              <ImageUpload label="Image" name="image" value={v.image ?? ""} onChange={(u) => set("image", u)} hint="Banner or product image." />
            </div>
          </div>
        </Card>
        <Card title="Appearance">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Button text" name="buttonText" value={v.buttonText ?? ""} onChange={(e) => set("buttonText", e.target.value)} maxLength={60} />
            <Input label="Countdown (seconds)" name="countdown" type="number" min={0} max={60} value={v.countdown ?? 0} onChange={(e) => set("countdown", Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)))} hint="Visitors wait this long before the button activates." />
            <ColorField label="Button color" name="buttonColor" value={v.buttonColor ?? "#6366f1"} onChange={(c) => set("buttonColor", c)} />
            <ColorField label="Background color" name="bgColor" value={v.bgColor ?? "#ffffff"} onChange={(c) => set("bgColor", c)} />
            <ColorField label="Text color" name="textColor" value={v.textColor ?? "#111827"} onChange={(c) => set("textColor", c)} />
          </div>
        </Card>
        <Card title="Advertising" description="Show your own ad code on the splash page.">
          <div className="space-y-4">
            <Switch name="showAds" label="Show ads" checked={!!v.showAds} onChange={(b) => set("showAds", b)} disabled={!adsAllowed} hint={adsAllowed ? undefined : "Splash ads are disabled by the administrator."} />
            {v.showAds && <Textarea label="Ad code" name="adCode" value={v.adCode ?? ""} onChange={(e) => set("adCode", e.target.value)} className="font-mono" placeholder="<script>...</script>" hint="Scripts run on the live page but not in the preview." />}
          </div>
        </Card>
        <Card title="Custom code">
          <div className="space-y-4">
            <Textarea label="Custom HTML" name="customHtml" value={v.customHtml ?? ""} onChange={(e) => set("customHtml", e.target.value)} className="font-mono" placeholder="<p>Any HTML shown below the image</p>" />
            {allowCss ? (
              <Textarea label="Custom CSS" name="customCss" value={v.customCss ?? ""} onChange={(e) => set("customCss", e.target.value)} className="font-mono" placeholder=".splash-title { letter-spacing: -0.02em }" hint="Classes: .splash-page, .splash-card, .splash-logo, .splash-title, .splash-description, .splash-image, .splash-html, .splash-button, .splash-ad" />
            ) : (
              <Alert type="info">Custom CSS is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to fully style your splash pages.</Alert>
            )}
          </div>
        </Card>
        <Card>
          <Switch name="isDefault" label="Use as default splash page" hint="Links with the custom splash redirect type and no page selected use the default." checked={v.isDefault} onChange={(b) => set("isDefault", b)} />
        </Card>
        <FormMessage state={state} />
        <div className="flex items-center gap-2">
          <SubmitButton>{isEdit ? "Save changes" : "Create splash page"}</SubmitButton>
          <Link href="/dashboard/splash" className="btn-secondary">Cancel</Link>
        </div>
      </div>
      <div className="lg:col-span-2 lg:sticky lg:top-20">
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Live preview</p><Button type="button" variant="ghost" size="sm" onClick={() => setPreviewKey((k) => k + 1)}><RotateCcw size={14} />Restart countdown</Button></div>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-bg">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card"><span className="h-2.5 w-2.5 rounded-full bg-danger/60" /><span className="h-2.5 w-2.5 rounded-full bg-warning/60" /><span className="h-2.5 w-2.5 rounded-full bg-success/60" /><span className="ml-2 text-[11px] text-muted truncate">yourdomain.com/alias</span></div>
          <div className="h-[520px] overflow-auto">
            <SplashView key={previewKey} splash={v} targetUrl="https://example.com/landing-page" preview />
          </div>
        </div>
      </div>
    </form>
  );
}
