"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Card, Input, Textarea, Select, Badge } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { generateSlugs, generateBio, createBioFromAi, clickInsights, type AiBio } from "./actions";

export function SlugTool() {
  const [state, action] = useActionState(generateSlugs, null);
  const data = state?.data as { url: string; slugs: { slug: string; available: boolean }[] } | undefined;
  return (
    <Card title="Slug generator" description="Get memorable custom aliases for a URL.">
      <form action={action} className="space-y-3">
        <Input label="Destination URL" name="url" required placeholder="https://example.com/my-long-article" />
        <Input label="Keywords (optional)" name="keywords" placeholder="summer sale, shoes" />
        <FormMessage state={state?.error ? state : null} />
        <SubmitButton>Suggest slugs</SubmitButton>
      </form>
      {data && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.slugs.map((s) => (
            <Link key={s.slug} href={`/dashboard/links/new?url=${encodeURIComponent(data.url)}&alias=${encodeURIComponent(s.slug)}`} className={"badge " + (s.available ? "bg-success/15 text-success hover:bg-success/25" : "bg-muted/15 text-muted line-through")} title={s.available ? "Create link with this alias" : "Taken"}>{s.slug}</Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function BioTool() {
  const [state, action] = useActionState(generateBio, null);
  const [createState, createAction] = useActionState(createBioFromAi, null);
  const data = state?.data as AiBio | undefined;
  const created = createState?.data as { id: string; alias: string } | undefined;
  return (
    <Card title="Bio page generator" description="Describe yourself; we draft a link-in-bio page you can create in one click.">
      <form action={action} className="space-y-3">
        <Textarea name="description" required minLength={10} placeholder="I'm a travel photographer based in Lisbon. I sell presets, post on Instagram @jane.shoots and YouTube, and take bookings by email hello@jane.com" />
        <FormMessage state={state?.error ? state : null} />
        <SubmitButton>Generate</SubmitButton>
      </form>
      {data && (
        <div className="mt-4 rounded-lg border border-border p-4 space-y-3">
          <div><p className="font-semibold">{data.name}</p><p className="text-sm text-muted">{data.bio}</p></div>
          <ul className="space-y-1 text-sm">{data.blocks.map((b, i) => <li key={i} className="flex items-center gap-2"><Badge color="gray">{b.type}</Badge><span>{b.title}</span>{b.url && <span className="text-xs text-muted truncate max-w-56">{b.url}</span>}</li>)}</ul>
          {created ? <p className="text-sm text-success">Created! <Link href={`/dashboard/bio/${created.id}`} className="underline">Edit your new bio page</Link> (/{created.alias})</p> : (
            <form action={createAction} className="space-y-2">
              <input type="hidden" name="payload" value={JSON.stringify(data)} />
              <FormMessage state={createState} />
              <SubmitButton variant="secondary">Create bio page</SubmitButton>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

export function InsightsTool({ links }: { links: { id: string; alias: string; title: string | null; clicks: number }[] }) {
  const [state, action] = useActionState(clickInsights, null);
  const data = state?.data as { text: string; total: number; unique: number; alias: string } | undefined;
  return (
    <Card title="Click insights" description="AI summary of the last 30 days for one of your links.">
      {links.length === 0 ? <p className="text-sm text-muted">Create some links first.</p> : (
        <form action={action} className="space-y-3">
          <Select label="Link" name="linkId" required>{links.map((l) => <option key={l.id} value={l.id}>/{l.alias}{l.title ? ` · ${l.title}` : ""} ({l.clicks} clicks)</option>)}</Select>
          <FormMessage state={state?.error ? state : null} />
          <SubmitButton>Analyse</SubmitButton>
        </form>
      )}
      {data && <div className="mt-4 rounded-lg border border-border p-4"><p className="text-xs text-muted mb-2">/{data.alias} · {data.total} clicks · {data.unique} unique</p><p className="text-sm whitespace-pre-wrap">{data.text}</p></div>}
    </Card>
  );
}
