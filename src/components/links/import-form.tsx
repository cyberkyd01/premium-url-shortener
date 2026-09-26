"use client";
import { useActionState } from "react";
import { Upload } from "lucide-react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { importCsv } from "@/app/dashboard/import/actions";

export function ImportForm() {
  const [state, action] = useActionState(importCsv, null);
  const data = state?.ok ? (state.data as { processed: number; failed: number; errors: { row: number; error: string }[] }) : null;
  return (
    <form action={action} className="space-y-4">
      <label className="block rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/50">
        <Upload size={22} className="mx-auto text-muted mb-2" />
        <span className="text-sm font-medium">Choose a CSV file</span>
        <span className="block text-xs text-muted mt-1">Columns: <code>url</code> (required), <code>alias</code>, <code>title</code>, <code>description</code>, <code>domain</code>, <code>channel</code>. Up to 500 rows per import.</span>
        <input type="file" name="file" accept=".csv,text/csv" className="block mx-auto mt-4 text-sm" required />
      </label>
      <FormMessage state={state} />
      {data && data.errors.length > 0 && (
        <div className="rounded-lg border border-border text-sm max-h-60 overflow-auto"><table className="table"><thead><tr><th>Row</th><th>Error</th></tr></thead><tbody>{data.errors.map((e) => <tr key={e.row}><td>{e.row}</td><td className="text-danger">{e.error}</td></tr>)}</tbody></table></div>
      )}
      <SubmitButton><Upload size={14} /> Import links</SubmitButton>
    </form>
  );
}
