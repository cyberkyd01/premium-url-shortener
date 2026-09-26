"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { X, Check, Copy, AlertCircle, Info, CheckCircle2 } from "lucide-react";

export function Card({ children, className, title, description, actions }: { children: ReactNode; className?: string; title?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cn("card", className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
          <div>{title && <h3 className="font-semibold">{title}</h3>}{description && <p className="text-sm text-muted mt-0.5">{description}</p>}</div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Button({ variant = "primary", size, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" }) {
  return <button className={cn(`btn-${variant}`, size === "sm" && "btn-sm", className)} {...props} />;
}

export function Input({ label, hint, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className={cn("input", error && "border-danger")} {...props} />
      {error ? <p className="hint text-danger">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Textarea({ label, hint, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input min-h-24" {...props} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Select({ label, hint, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select className="input" {...props}>{children}</select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Switch({ label, checked, onChange, name, hint, disabled }: { label?: string; checked: boolean; onChange?: (v: boolean) => void; name?: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start gap-3 cursor-pointer select-none", disabled && "opacity-50")}>
      <span onClick={() => !disabled && onChange?.(!checked)} className={cn("mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-muted/40")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", checked ? "left-4.5" : "left-0.5")} />
      </span>
      {name && <input type="hidden" name={name} value={checked ? "1" : "0"} />}
      <span><span className="text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

export function Badge({ children, color = "gray" }: { children: ReactNode; color?: "green" | "red" | "yellow" | "gray" | "blue" }) {
  return <span className={`badge-${color}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className={cn("card w-full max-h-[90vh] overflow-auto animate-in", wide ? "max-w-4xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Alert({ type = "info", children }: { type?: "info" | "success" | "error" | "warning"; children: ReactNode }) {
  const styles = { info: "bg-primary/10 text-primary", success: "bg-success/10 text-success", error: "bg-danger/10 text-danger", warning: "bg-warning/10 text-warning" };
  const Icon = type === "success" ? CheckCircle2 : type === "error" ? AlertCircle : Info;
  return <div className={cn("flex items-start gap-2 rounded-lg px-4 py-3 text-sm", styles[type])}><Icon size={16} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}

export function CopyButton({ text, className, label }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className={cn("btn-secondary btn-sm", className)} onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}{label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}

export function Empty({ title = "Nothing here yet", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="text-center py-12"><p className="font-medium">{title}</p>{description && <p className="text-sm text-muted mt-1">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="card p-5"><p className="text-sm text-muted">{label}</p><p className="text-2xl font-bold mt-1">{value}</p>{sub && <p className="text-xs text-muted mt-1">{sub}</p>}</div>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-bold">{title}</h1>{description && <p className="text-muted text-sm mt-1">{description}</p>}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
      {tabs.map((t) => <button key={t.key} type="button" onClick={() => onChange(t.key)} className={cn("px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap", value === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-fg")}>{t.label}</button>)}
    </div>
  );
}
