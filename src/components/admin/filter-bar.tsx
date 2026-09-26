"use client";
import { useRef } from "react";
import { Search } from "lucide-react";

export interface FilterField { name: string; type?: "text" | "select" | "date"; placeholder?: string; options?: { value: string; label: string }[]; value?: string }

/** GET form used on list pages; selects auto-submit. */
export function FilterBar({ fields, action, children }: { fields: FilterField[]; action?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} method="get" action={action} className="flex flex-wrap items-center gap-2 mb-4">
      {fields.map((f) => f.type === "select" ? (
        <select key={f.name} name={f.name} defaultValue={f.value ?? ""} className="input w-auto" onChange={() => ref.current?.requestSubmit()}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : f.type === "date" ? (
        <input key={f.name} type="date" name={f.name} defaultValue={f.value ?? ""} className="input w-auto" onChange={() => ref.current?.requestSubmit()} />
      ) : (
        <input key={f.name} name={f.name} defaultValue={f.value ?? ""} placeholder={f.placeholder ?? "Search…"} className="input w-56" />
      ))}
      <button type="submit" className="btn-secondary btn-sm"><Search size={14} />Filter</button>
      {children}
    </form>
  );
}
