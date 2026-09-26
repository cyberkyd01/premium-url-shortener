"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Card, Input, Textarea, Select, Switch, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ImageUpload } from "@/components/splash/image-upload";
import { OverlayWidget } from "./overlay-widget";
import { OVERLAY_TYPES, OVERLAY_POSITIONS, type OverlayOptions, type OverlayType, type OverlayPosition } from "./overlay-types";
import { createOverlay, updateOverlay } from "@/app/dashboard/overlays/actions";
import { Plus, X, RotateCcw } from "lucide-react";

export interface OverlayFormValues {
  id?: string; name: string; type: OverlayType; position: OverlayPosition; title: string; message: string; buttonText: string; buttonUrl: string; image: string; video: string;
  bgColor: string; textColor: string; accentColor: string; delay: number; disclaimer: string; options: OverlayOptions;
}

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

const FORM_TYPES: OverlayType[] = ["contact", "poll", "newsletter"];

export function OverlayForm({ overlay }: { overlay?: OverlayFormValues }) {
  const isEdit = !!overlay?.id;
  const [state, action] = useActionState(isEdit ? updateOverlay : createOverlay, null);
  const [v, setV] = useState<OverlayFormValues>(overlay ?? {
    name: "", type: "message", position: "bottom-left", title: "", message: "", buttonText: "", buttonUrl: "", image: "", video: "",
    bgColor: "#ffffff", textColor: "#111827", accentColor: "#6366f1", delay: 2, disclaimer: "", options: { pollOptions: ["Yes", "No"], formFields: ["name", "email", "message"], showClose: true },
  });
  const set = <K extends keyof OverlayFormValues>(k: K, val: OverlayFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setOpt = <K extends keyof OverlayOptions>(k: K, val: OverlayOptions[K]) => setV((p) => ({ ...p, options: { ...p.options, [k]: val } }));
  const [previewKey, setPreviewKey] = useState(0);
  const pollOptions = v.options.pollOptions ?? [];
  const formFields = v.options.formFields ?? ["name", "email", "message"];
  const isForm = FORM_TYPES.includes(v.type);
  const hasButton = ["message", "cta", "image", "video", "coupon"].includes(v.type);
  const typeDef = OVERLAY_TYPES.find((t) => t.key === v.type);

  return (
    <form action={action} className="grid lg:grid-cols-5 gap-6 items-start">
      {overlay?.id && <input type="hidden" name="id" value={overlay.id} />}
      <div className="lg:col-span-3 space-y-6">
        <Card title="General">
          <div className="space-y-4">
            <Input label="Name" name="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} hint="Internal name shown when choosing an overlay for a link." />
            <div className="grid sm:grid-cols-2 gap-4">
              <Select label="Type" name="type" value={v.type} onChange={(e) => set("type", e.target.value as OverlayType)} hint={typeDef?.description}>
                {OVERLAY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
              <Select label="Position" name="position" value={v.position} onChange={(e) => set("position", e.target.value as OverlayPosition)}>
                {OVERLAY_POSITIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
            <Input label="Delay (seconds)" name="delay" type="number" min={0} max={120} value={v.delay} onChange={(e) => set("delay", Math.max(0, Math.min(120, parseInt(e.target.value, 10) || 0)))} hint="Time after page load before the overlay appears." />
          </div>
        </Card>
        <Card title="Content">
          <div className="space-y-4">
            <Input label={v.type === "poll" ? "Question" : v.type === "cta" ? "Headline" : "Title"} name="title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
            <Textarea label="Message" name="message" value={v.message} onChange={(e) => set("message", e.target.value)} maxLength={2000} />
            {v.type === "poll" && (
              <div>
                <label className="label">Poll options</label>
                <div className="space-y-2">
                  {pollOptions.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className="input" name="pollOptions" value={o} maxLength={100} onChange={(e) => setOpt("pollOptions", pollOptions.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => setOpt("pollOptions", pollOptions.filter((_, j) => j !== i))} disabled={pollOptions.length <= 2}><X size={14} /></Button>
                    </div>
                  ))}
                  {pollOptions.length < 10 && <Button type="button" variant="secondary" size="sm" onClick={() => setOpt("pollOptions", [...pollOptions, ""])}><Plus size={14} />Add option</Button>}
                </div>
              </div>
            )}
            {v.type === "contact" && (
              <div>
                <label className="label">Form fields</label>
                <div className="flex flex-wrap gap-4">
                  {(["name", "email", "message"] as const).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm"><input type="checkbox" name="formFields" value={f} checked={formFields.includes(f)} onChange={(e) => setOpt("formFields", e.target.checked ? [...formFields, f] : formFields.filter((x) => x !== f))} className="accent-primary" />{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                  ))}
                </div>
              </div>
            )}
            {v.type === "coupon" && <Input label="Coupon code" name="couponCode" value={v.options.couponCode ?? ""} onChange={(e) => setOpt("couponCode", e.target.value.toUpperCase())} maxLength={40} required placeholder="SAVE10" className="font-mono" />}
            {(v.type === "image" || v.type === "message") && <ImageUpload label="Image" name="image" value={v.image} onChange={(u) => set("image", u)} />}
            {v.type === "video" && <Input label="Video URL" name="video" type="url" value={v.video} onChange={(e) => set("video", e.target.value)} required placeholder="https://www.youtube.com/watch?v=..." hint="YouTube, Vimeo or a direct MP4 link." />}
            {(hasButton || isForm) && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Button text" name="buttonText" value={v.buttonText} onChange={(e) => set("buttonText", e.target.value)} maxLength={60} placeholder={isForm ? (v.type === "poll" ? "Vote" : v.type === "newsletter" ? "Subscribe" : "Send") : "Learn more"} />
                {hasButton && <Input label="Button URL" name="buttonUrl" type="url" value={v.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} placeholder="https://example.com" />}
              </div>
            )}
            {hasButton && <Switch name="buttonNewTab" label="Open button link in a new tab" checked={!!v.options.buttonNewTab} onChange={(b) => setOpt("buttonNewTab", b)} />}
            {isForm && (
              <>
                <Input label="Success message" name="successMessage" value={v.options.successMessage ?? ""} onChange={(e) => setOpt("successMessage", e.target.value)} maxLength={200} placeholder="Thank you!" />
                <Textarea label="Disclaimer" name="disclaimer" value={v.disclaimer} onChange={(e) => set("disclaimer", e.target.value)} maxLength={500} placeholder="By submitting you agree to our privacy policy." hint="Shown in small print under the form." />
              </>
            )}
            {!isForm && <input type="hidden" name="disclaimer" value={v.disclaimer} />}
          </div>
        </Card>
        <Card title="Appearance">
          <div className="grid sm:grid-cols-3 gap-4">
            <ColorField label="Background" name="bgColor" value={v.bgColor} onChange={(c) => set("bgColor", c)} />
            <ColorField label="Text" name="textColor" value={v.textColor} onChange={(c) => set("textColor", c)} />
            <ColorField label="Accent / button" name="accentColor" value={v.accentColor} onChange={(c) => set("accentColor", c)} />
          </div>
          <div className="mt-4"><Switch name="showClose" label="Show close button" checked={v.options.showClose ?? true} onChange={(b) => setOpt("showClose", b)} /></div>
        </Card>
        <FormMessage state={state} />
        <div className="flex items-center gap-2">
          <SubmitButton>{isEdit ? "Save changes" : "Create overlay"}</SubmitButton>
          <Link href="/dashboard/overlays" className="btn-secondary">Cancel</Link>
        </div>
      </div>
      <div className="lg:col-span-2 lg:sticky lg:top-20">
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Live preview</p><Button type="button" variant="ghost" size="sm" onClick={() => setPreviewKey((k) => k + 1)}><RotateCcw size={14} />Reset</Button></div>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card"><span className="h-2.5 w-2.5 rounded-full bg-danger/60" /><span className="h-2.5 w-2.5 rounded-full bg-warning/60" /><span className="h-2.5 w-2.5 rounded-full bg-success/60" /><span className="ml-2 text-[11px] text-muted truncate">destination-website.com</span></div>
          <div className="relative h-[520px] overflow-hidden bg-[#f3f4f6]">
            <div className="p-6 space-y-3 opacity-40 select-none">
              <div className="h-6 w-1/2 rounded bg-gray-400" /><div className="h-3 w-full rounded bg-gray-300" /><div className="h-3 w-5/6 rounded bg-gray-300" /><div className="h-3 w-4/6 rounded bg-gray-300" /><div className="h-40 w-full rounded bg-gray-300 mt-4" /><div className="h-3 w-full rounded bg-gray-300" /><div className="h-3 w-3/4 rounded bg-gray-300" />
            </div>
            <OverlayWidget key={previewKey} overlay={{ id: overlay?.id ?? "preview", type: v.type, position: v.position, title: v.title, message: v.message, buttonText: v.buttonText, buttonUrl: v.buttonUrl, image: v.image, video: v.video, options: v.options, bgColor: v.bgColor, textColor: v.textColor, accentColor: v.accentColor, delay: v.delay, disclaimer: v.disclaimer }} submitUrl="/api/overlay-response" preview />
          </div>
        </div>
        <p className="text-xs text-muted mt-2">Preview shows the overlay immediately; on the live page it appears after {v.delay}s.</p>
      </div>
    </form>
  );
}
