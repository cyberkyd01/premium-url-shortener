"use client";
import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { cn } from "@/lib/utils";
import type { AdminAction } from "./action-button";

/** Generic server-action form: children are ordinary inputs; shows the result message and optional redirect. */
export function ActionForm({ action, hidden, children, submitLabel = "Save", className, redirectTo, confirm, footer, variant = "primary", refreshOnSuccess }: {
  action: AdminAction; hidden?: Record<string, string>; children: ReactNode; submitLabel?: ReactNode; className?: string;
  redirectTo?: string; confirm?: string; footer?: ReactNode; variant?: "primary" | "secondary" | "danger"; refreshOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    const data = state.data as { redirect?: string } | undefined;
    if (data?.redirect) router.push(data.redirect);
    else if (redirectTo) router.push(redirectTo);
    else if (refreshOnSuccess) router.refresh();
  }, [state, redirectTo, refreshOnSuccess, router]);
  return (
    <form action={formAction} className={cn("space-y-4", className)} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <FormMessage state={state} />
      <div className="flex items-center gap-2 flex-wrap">{footer}<SubmitButton variant={variant}>{submitLabel}</SubmitButton></div>
    </form>
  );
}
