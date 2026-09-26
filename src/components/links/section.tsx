"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible editor section with an optional plan lock hint. */
export function Section({ title, description, locked, children, defaultOpen = false, badge }: { title: string; description?: string; locked?: boolean; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0"><h3 className="font-semibold flex items-center gap-2">{title}{locked && <Lock size={13} className="text-warning" />}</h3>{description && <p className="text-xs text-muted mt-0.5">{description}</p>}</div>
          {badge}
        </div>
        <ChevronDown size={16} className={cn("shrink-0 transition text-muted", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          {locked && <p className="rounded-lg bg-warning/10 text-warning text-xs px-3 py-2">This feature is not included in your plan. <Link href="/dashboard/billing" className="underline font-medium">Upgrade</Link> to unlock it.</p>}
          <fieldset disabled={locked} className={cn("space-y-4", locked && "opacity-60")}>{children}</fieldset>
        </div>
      )}
    </div>
  );
}

export function RowList<T>({ rows, onChange, empty, add, render, addLabel = "Add rule" }: { rows: T[]; onChange: (rows: T[]) => void; empty: string; add: () => T; render: (row: T, set: (patch: Partial<T>) => void, remove: () => void, index: number) => ReactNode; addLabel?: string }) {
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-xs text-muted">{empty}</p>}
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-border p-3 bg-bg/50">
          {render(row, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))), () => onChange(rows.filter((_, j) => j !== i)), i)}
        </div>
      ))}
      <button type="button" className="btn-secondary btn-sm" onClick={() => onChange([...rows, add()])}>+ {addLabel}</button>
    </div>
  );
}
