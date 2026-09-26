"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

/**
 * A one-click server-action button (e.g. "Check now", "Delete") with inline result message.
 * `hidden` fields are posted with the form; `confirm` shows a native confirm dialog first.
 */
export function ActionButton({ action, hidden = {}, children, variant = "secondary", size = "sm", className, confirm: confirmMsg, showMessage = true }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; hidden?: Record<string, string>; children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm"; className?: string; confirm?: string; showMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("inline-flex items-center gap-2", className)} onSubmit={(e) => { if (confirmMsg && !confirm(confirmMsg)) e.preventDefault(); }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={pending} className={cn(`btn-${variant}`, size === "sm" && "btn-sm")}>{pending && <Loader2 size={14} className="animate-spin" />}{children}</button>
      {showMessage && state?.error && <span className="text-xs text-danger">{state.error}</span>}
      {showMessage && state?.message && <span className="text-xs text-success">{state.message}</span>}
    </form>
  );
}
