"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";

const OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "none", label: "Off", hint: "No email digests" },
  { value: "weekly", label: "Weekly", hint: "Every Monday morning" },
  { value: "monthly", label: "Monthly", hint: "On the 1st of each month" },
];

/** Radio group posting to `setReportFrequency` (src/app/dashboard/reports/actions.ts). */
export function ReportFrequencyForm({ value, action, lastSentAt }: { value: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState>; lastSentAt?: string | null }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label key={o.value} className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-bg has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="frequency" value={o.value} defaultChecked={value === o.value} className="mt-1" />
            <span><span className="block text-sm font-medium">{o.label}</span><span className="block text-xs text-muted">{o.hint}</span></span>
          </label>
        ))}
      </div>
      <FormMessage state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton size="sm">Save preference</SubmitButton>
        {lastSentAt && <span className="text-xs text-muted">Last digest sent {lastSentAt}</span>}
      </div>
    </form>
  );
}
