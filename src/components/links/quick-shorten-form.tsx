"use client";
import { useActionState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { quickShorten } from "@/app/dashboard/links/actions";

export function QuickShortenForm({ domains, appHost, mainUsable }: { domains: { id: string; domain: string }[]; appHost: string; mainUsable: boolean }) {
  const [state, action] = useActionState(quickShorten, null);
  const data = state?.ok ? (state.data as { id: string; short: string }) : null;
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input name="url" className="input" placeholder="Paste a long URL…" required />
        {(domains.length > 0) && <select name="domainId" className="input sm:w-48">{(mainUsable || !domains.length) && <option value="">{appHost}</option>}{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select>}
        <input name="alias" className="input sm:w-40" placeholder="alias (optional)" />
        <SubmitButton>Shorten</SubmitButton>
      </div>
      <FormMessage state={state} />
      {data && <div className="flex flex-wrap items-center gap-2 text-sm"><a href={data.short} target="_blank" rel="noreferrer" className="text-primary font-medium">{data.short}</a><CopyButton text={data.short} /><Link href={`/dashboard/links/${data.id}/edit`} className="btn-ghost btn-sm">Customize</Link><Link href={`/dashboard/links/${data.id}`} className="btn-ghost btn-sm">Stats</Link></div>}
    </form>
  );
}
