"use client";
import type { ReactNode } from "react";

/** Wraps a server-action form with a native confirm dialog. */
export function ConfirmForm({ action, children, message = "Are you sure?", className, hidden }: { action: (fd: FormData) => void | Promise<void>; children: ReactNode; message?: string; className?: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} className={className} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </form>
  );
}
