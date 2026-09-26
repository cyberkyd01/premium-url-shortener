"use client";
import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { aiInsights } from "@/app/dashboard/links/actions";

export function AiInsightsButton({ linkId, days }: { linkId: string; days: number }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => start(async () => { setError(""); const r = await aiInsights(linkId, days); if (r?.error) setError(r.error); else setText(String(r?.data ?? "")); })}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {text ? "Regenerate insights" : "Generate AI insights"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {text && <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm whitespace-pre-line">{text}</div>}
    </div>
  );
}
