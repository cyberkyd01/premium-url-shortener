"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AdminAction } from "./action-button";

/** Submit button for use INSIDE another form (e.g. a BulkForm table row): calls its own server action via `formAction`
 *  without nesting a second <form>. The surrounding BulkForm skips its own validation for buttons marked data-row-action. */
export function RowAction({ action, hidden, confirm, children, variant = "secondary", className }: { action: AdminAction; hidden: Record<string, string>; confirm?: string; children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <>
      <button type="submit" data-row-action="1" disabled={pending} className={cn(`btn-${variant}`, "btn-sm", className)}
        onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
        formAction={() => start(async () => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
          const r = await action(null, fd);
          if (r?.error) setErr(r.error); else { setErr(""); router.refresh(); }
        })}>
        {children}
      </button>
      {err && <span className="text-xs text-danger ml-1">{err}</span>}
    </>
  );
}
