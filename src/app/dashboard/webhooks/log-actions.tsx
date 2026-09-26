"use client";
import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Trash2, Send, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearLogs, reactivateWebhook, retryDelivery, sendTest } from "./actions";
import type { ActionState } from "@/components/ui/form-state";

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionState>) => start(async () => { const r = await fn(); if (r?.error) setMsg({ ok: false, text: r.error }); else if (r?.message) setMsg({ ok: true, text: r.message }); });
  return { pending, msg, run };
}

export function RetryButton({ logId }: { logId: string }) {
  const { pending, msg, run } = useRun();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run(() => retryDelivery(logId))}>{pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Retry now</button>
      {msg && <span className={cn("text-xs", msg.ok ? "text-success" : "text-danger")}>{msg.text}</span>}
    </span>
  );
}

export function ClearLogsButton({ webhookId }: { webhookId?: string }) {
  const { pending, msg, run } = useRun();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-danger btn-sm" disabled={pending} onClick={() => { if (confirm("Clear webhook delivery logs?")) run(() => clearLogs(webhookId)); }}>{pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Clear logs</button>
      {msg && <span className={cn("text-xs", msg.ok ? "text-success" : "text-danger")}>{msg.text}</span>}
    </span>
  );
}

export function HookButtons({ webhookId, active }: { webhookId: string; active: boolean }) {
  const { pending, msg, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => run(() => sendTest(webhookId))}>{pending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send test</button>
      {!active && <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => run(() => reactivateWebhook(webhookId))}><Power size={13} /> Re-enable</button>}
      {msg && <span className={cn("text-xs", msg.ok ? "text-success" : "text-danger")}>{msg.text}</span>}
    </div>
  );
}
