"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Input, Textarea, Select, Switch, Card, Alert } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { createCampaign, updateCampaign } from "@/app/dashboard/campaigns/actions";

export interface CampaignFormValues { id?: string; name: string; slug: string; description: string | null; color: string; isPublic: boolean; isRotator: boolean; rotatorAlias: string | null; rotatorMode: string }

const PRESETS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#64748b"];

function slugifyClient(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function CampaignForm({ campaign, appHost, publicReady }: { campaign?: CampaignFormValues; appHost: string; publicReady: boolean }) {
  const isEdit = !!campaign?.id;
  const [state, action] = useActionState(isEdit ? updateCampaign : createCampaign, null);
  const [name, setName] = useState(campaign?.name ?? "");
  const [slug, setSlug] = useState(campaign?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [colorValue, setColorValue] = useState(campaign?.color ?? PRESETS[0]);
  const [isPublic, setIsPublic] = useState(campaign?.isPublic ?? false);
  const [isRotator, setIsRotator] = useState(campaign?.isRotator ?? false);
  const effectiveSlug = slugTouched ? slug : slugifyClient(name);
  return (
    <form action={action} className="space-y-6">
      {campaign?.id && <input type="hidden" name="id" value={campaign.id} />}
      <Card title="Campaign details">
        <div className="space-y-4">
          <Input label="Name" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Spring product launch" />
          <Input label="Slug" name="slug" value={effectiveSlug} onChange={(e) => { setSlugTouched(true); setSlug(slugifyClient(e.target.value)); }} maxLength={80} hint={`Public campaign page: ${appHost}/campaign/${effectiveSlug || "your-slug"}`} />
          <Textarea label="Description" name="description" defaultValue={campaign?.description ?? ""} maxLength={1000} placeholder="Optional notes shown on the public campaign page" />
          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((c) => <button key={c} type="button" onClick={() => setColorValue(c)} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: colorValue === c ? "var(--fg)" : "transparent" }} aria-label={c} />)}
              <input type="color" value={colorValue} onChange={(e) => setColorValue(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent" />
            </div>
            <input type="hidden" name="color" value={colorValue} />
          </div>
        </div>
      </Card>
      <Card title="Public campaign page" description="Share a single page listing every link in this campaign.">
        <div className="space-y-3">
          <Switch name="isPublic" label="Make this campaign public" hint={`Visible at ${appHost}/campaign/${effectiveSlug || "your-slug"}`} checked={isPublic} onChange={setIsPublic} />
          {isPublic && !publicReady && (
            <Alert type="warning">Public campaign pages require a <strong>default bio page</strong> and a <strong>public account</strong>. Set a default page under <Link href="/dashboard/bio" className="underline">Bio Pages</Link> and enable &quot;Public account&quot; in <Link href="/dashboard/settings" className="underline">Settings</Link>, otherwise the page shows nothing.</Alert>
          )}
        </div>
      </Card>
      <Card title="Link rotator" description="Distribute traffic from one alias across all links in the campaign.">
        <div className="space-y-4">
          <Switch name="isRotator" label="Enable link rotation" checked={isRotator} onChange={setIsRotator} />
          {isRotator && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Rotator alias" name="rotatorAlias" defaultValue={campaign?.rotatorAlias ?? ""} required maxLength={64} pattern="[A-Za-z0-9_-]{1,64}" hint={`Visitors of ${appHost}/alias are rotated between links`} placeholder="my-rotator" />
              <Select label="Rotation mode" name="rotatorMode" defaultValue={campaign?.rotatorMode ?? "sequential"} hint="Weighted uses each link's click share to pick the next target">
                <option value="sequential">Sequential (round-robin)</option>
                <option value="random">Random</option>
                <option value="weighted">Weighted</option>
              </Select>
            </div>
          )}
        </div>
      </Card>
      <FormMessage state={state} />
      <div className="flex items-center gap-2">
        <SubmitButton>{isEdit ? "Save changes" : "Create campaign"}</SubmitButton>
        <Link href={isEdit && campaign?.id ? `/dashboard/campaigns/${campaign.id}` : "/dashboard/campaigns"} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
