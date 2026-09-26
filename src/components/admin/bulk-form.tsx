"use client";
import { useActionState, useRef, type ReactNode } from "react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import type { AdminAction } from "./action-button";

/** Wraps a table whose rows contain `<input type="checkbox" name="ids" value=… />`; submits the chosen bulk action. */
export function BulkForm({ action, options, children, extra }: { action: AdminAction; options: { value: string; label: string }[]; children: ReactNode; extra?: ReactNode }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const toggleAll = (checked: boolean) => ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((el) => { el.checked = checked; });
  return (
    <form ref={ref} action={formAction} onSubmit={(e) => { if ((e.nativeEvent as SubmitEvent).submitter?.hasAttribute("data-row-action")) return; const sel = ref.current?.querySelector<HTMLSelectElement>('select[name="bulk"]')?.value; if (!sel) e.preventDefault(); else if (sel.includes("delete") && !window.confirm("Delete selected items?")) e.preventDefault(); }}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="text-sm flex items-center gap-2"><input type="checkbox" className="accent-primary" onChange={(e) => toggleAll(e.target.checked)} />Select all</label>
        <select name="bulk" className="input w-auto" defaultValue=""><option value="">Bulk action…</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {extra}
        <SubmitButton variant="secondary" size="sm">Apply</SubmitButton>
        <FormMessage state={state} />
      </div>
      {children}
    </form>
  );
}
