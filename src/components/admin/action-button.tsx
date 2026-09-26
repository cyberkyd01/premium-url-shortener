"use client";
import { useActionState, type ReactNode } from "react";
import { SubmitButton, type ActionState } from "@/components/ui/form-state";
import { cn } from "@/lib/utils";

export type AdminAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Tiny inline form that calls a server action with hidden fields (optionally after a confirm dialog). */
export function ActionButton({ action, hidden, confirm, children, variant = "secondary", size = "sm", className, showMessage = true }: {
  action: AdminAction; hidden?: Record<string, string>; confirm?: string; children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm"; className?: string; showMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("inline-flex items-center gap-1", className)} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size}>{children}</SubmitButton>
      {showMessage && state?.error && <span className="text-xs text-danger">{state.error}</span>}
      {showMessage && state?.message && <span className="text-xs text-success">{state.message}</span>}
    </form>
  );
}
