"use client";
import { useActionState, useState } from "react";
import { Input, Select } from "@/components/ui";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";

export interface ShareOption { id: string; label: string }

/** Create-a-share-link form: pick a link / campaign / bio page, optional title, password and expiry. */
export function ShareReportForm({ action, links, campaigns, bioPages }: { action: (prev: ActionState, fd: FormData) => Promise<ActionState>; links: ShareOption[]; campaigns: ShareOption[]; bioPages: ShareOption[] }) {
  const [state, formAction] = useActionState(action, null);
  const [kind, setKind] = useState<"link" | "campaign" | "bio">("link");
  const options = kind === "link" ? links : kind === "campaign" ? campaigns : bioPages;
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Share analytics of" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "link" | "campaign" | "bio")}>
          <option value="link">A short link</option>
          <option value="campaign">A campaign (all its links)</option>
          <option value="bio">A bio page</option>
        </Select>
        <Select label={kind === "link" ? "Link" : kind === "campaign" ? "Campaign" : "Bio page"} name="targetId" key={kind} defaultValue="" required>
          <option value="" disabled>Select…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
        <Input label="Title (optional)" name="title" placeholder="Q3 campaign results" maxLength={120} />
        <Input label="Password (optional)" name="password" type="password" autoComplete="new-password" placeholder="Viewers must enter this" hint="Leave empty for a public page." />
        <Input label="Expires (optional)" name="expiresAt" type="datetime-local" hint="The link stops working after this date." />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Create share link</SubmitButton>
    </form>
  );
}
