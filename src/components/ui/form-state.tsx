"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./index";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: unknown } | null | undefined;

export function SubmitButton({ children, variant = "primary", className, size }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string; size?: "sm" }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} className={className} size={size} disabled={pending}>{pending && <Loader2 size={14} className="animate-spin" />}{children}</Button>;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <div className="rounded-lg bg-danger/10 text-danger text-sm px-4 py-3">{state.error}</div>;
  if (state.message) return <div className="rounded-lg bg-success/10 text-success text-sm px-4 py-3">{state.message}</div>;
  return null;
}
