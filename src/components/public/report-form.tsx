"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { sendReport } from "@/app/(public)/report/actions";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam or misleading" }, { value: "phishing", label: "Phishing / scam" }, { value: "malware", label: "Malware or virus" },
  { value: "adult", label: "Adult or inappropriate content" }, { value: "copyright", label: "Copyright infringement" }, { value: "other", label: "Other" },
];

export function ReportForm({ defaultTarget, defaultEmail }: { defaultTarget?: string; defaultEmail?: string }) {
  const [state, action] = useActionState(sendReport, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div><label className="label" htmlFor="target">Short link or alias</label><input id="target" name="target" className="input" placeholder="https://example.com/abc123 or abc123" defaultValue={defaultTarget} required /></div>
      <div>
        <label className="label" htmlFor="reason">Reason</label>
        <select id="reason" name="reason" className="input" required defaultValue="">
          <option value="" disabled>Select a reason</option>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="details">Details</label><textarea id="details" name="details" className="input min-h-32" placeholder="Tell us what you found and where." maxLength={5000} /></div>
      <div><label className="label" htmlFor="email">Your email (optional)</label><input id="email" name="email" type="email" className="input" defaultValue={defaultEmail} /><p className="hint">We only use it to follow up on this report.</p></div>
      <SubmitButton variant="danger">Submit report</SubmitButton>
    </form>
  );
}
