"use client";
import { useActionState } from "react";
import { Download, Lock, Printer } from "lucide-react";
import { Input } from "@/components/ui";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";

/** Print / Save-as-PDF and CSV download buttons for the public shared report. */
export function ShareTools({ byDay, filename }: { byDay: { date: string; clicks: number }[]; filename: string }) {
  const download = () => {
    const csv = ["date,clicks", ...byDay.map((d) => `${d.date},${d.clicks}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="flex items-center gap-2 no-print">
      <button type="button" className="btn-secondary btn-sm" onClick={download}><Download size={14} /> Download CSV</button>
      <button type="button" className="btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
    </div>
  );
}

/** Password prompt for protected shared reports. Reloads on success so the server re-renders with the cookie. */
export function SharePasswordForm({ token, action }: { token: string; action: (prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok) window.location.reload();
    return r;
  }, null);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Input label="Password" name="password" type="password" autoFocus required placeholder="Enter the report password" />
      <FormMessage state={state} />
      <SubmitButton className="w-full"><Lock size={14} /> View report</SubmitButton>
    </form>
  );
}
