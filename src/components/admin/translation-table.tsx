"use client";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import type { AdminAction } from "./action-button";

export function TranslationTable({ action, code, rows }: { action: AdminAction; code: string; rows: { key: string; en: string; value: string }[] }) {
  const [state, formAction] = useActionState(action, null);
  const [q, setQ] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const visible = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) => (!onlyMissing || !r.value) && (!s || r.key.toLowerCase().includes(s) || r.en.toLowerCase().includes(s) || r.value.toLowerCase().includes(s)));
  }, [rows, q, onlyMissing]);
  const hidden = rows.filter((r) => !visible.includes(r));
  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input className="input w-72" placeholder="Search keys or text…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />Only missing</label>
        <span className="text-xs text-muted">{visible.length} of {rows.length} shown</span>
        <span className="flex-1" />
        <FormMessage state={state} />
        <SubmitButton>Save translations</SubmitButton>
      </div>
      {hidden.map((r) => <input key={r.key} type="hidden" name={`t:${r.key}`} value={r.value} />)}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th className="w-1/4">Key</th><th className="w-1/3">English</th><th>Translation</th></tr></thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.key}>
                <td className="font-mono text-xs text-muted align-top">{r.key}</td>
                <td className="text-sm align-top">{r.en}</td>
                <td><textarea name={`t:${r.key}`} defaultValue={r.value} placeholder={r.en} rows={1} className="input min-h-9 text-sm" dir="auto" /></td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-8">No strings match.</td></tr>}
          </tbody>
        </table>
      </div>
    </form>
  );
}
