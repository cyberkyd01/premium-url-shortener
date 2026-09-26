"use client";
import { useState, useTransition } from "react";
import { Download, KeyRound, Loader2 } from "lucide-react";
import { Button, CopyButton } from "@/components/ui";
import { FormMessage, type ActionState } from "@/components/ui/form-state";
import { generateBackupCodes } from "./actions";

function codesFrom(state: ActionState): string[] | null {
  const d = state?.data;
  if (!d || typeof d !== "object" || !("codes" in d)) return null;
  const codes = (d as { codes?: unknown }).codes;
  return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string") : null;
}

/** Generates/regenerates one-time 2FA backup codes and shows them once with copy/download. */
export function BackupCodes({ remaining, siteName }: { remaining: number; siteName: string }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const codes = codesFrom(state);
  const left = codes ? codes.length : remaining;
  const text = codes ? codes.join("\n") : "";

  const download = () => {
    const blob = new Blob([`${siteName} two-factor backup codes\nEach code can be used once.\n\n${text}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "backup-codes.txt"; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium flex items-center gap-2"><KeyRound size={14} />Backup codes</p>
          <p className="text-xs text-muted">Use a backup code to log in if you lose your device. {left > 0 ? `${left} code${left === 1 ? "" : "s"} remaining.` : "No backup codes generated yet."}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => { if (left > 0 && !confirm("Regenerating replaces all existing backup codes. Continue?")) return; start(async () => { setState(await generateBackupCodes()); }); }}>
          {pending && <Loader2 size={14} className="animate-spin" />}{left > 0 ? "Regenerate codes" : "Generate backup codes"}
        </Button>
      </div>
      <FormMessage state={state} />
      {codes && (
        <div className="rounded-lg border border-border bg-bg p-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 font-mono text-sm">{codes.map((c) => <code key={c} className="px-2 py-1 rounded bg-card border border-border text-center">{c}</code>)}</div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} label="Copy codes" />
            <Button type="button" variant="secondary" size="sm" onClick={download}><Download size={14} />Download .txt</Button>
          </div>
        </div>
      )}
    </div>
  );
}
