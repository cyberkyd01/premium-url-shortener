"use client";
import { CopyButton } from "@/components/ui";

/** Read-only code block with a copy button. */
export function SnippetBox({ label, code, hint }: { label: string; code: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-medium">{label}</span>
        <CopyButton text={code} />
      </div>
      <pre className="rounded-lg bg-fg/5 border border-border p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all"><code>{code}</code></pre>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
