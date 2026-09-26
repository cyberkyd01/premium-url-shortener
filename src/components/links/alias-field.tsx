"use client";
import { useEffect, useState } from "react";
import { Check, X, Loader2, Sparkles } from "lucide-react";
import { checkAlias, suggestSlug } from "@/app/dashboard/links/actions";

export function AliasField({ value, onChange, domainId, excludeId, prefix, aiEnabled, url, title, disabled, hint }: {
  value: string; onChange: (v: string) => void; domainId: string | null; excludeId?: string; prefix: string; aiEnabled: boolean; url: string; title: string; disabled?: boolean; hint?: string;
}) {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  useEffect(() => {
    const a = value.trim();
    if (!a) { setStatus("idle"); return; }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(a)) { setStatus("invalid"); return; }
    setStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/links/alias-check?alias=${encodeURIComponent(a)}&domainId=${encodeURIComponent(domainId ?? "")}${excludeId ? `&exclude=${excludeId}` : ""}`);
        const d = (await r.json()) as { available?: boolean };
        setStatus(d.available ? "ok" : "taken");
      } catch {
        const d = await checkAlias(a, domainId, excludeId);
        setStatus(d.available ? "ok" : "taken");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, domainId, excludeId]);
  async function ai() {
    setAiBusy(true); setAiError(""); setSuggestions([]);
    const r = await suggestSlug(url, title);
    setAiBusy(false);
    if (r?.error) setAiError(r.error); else if (Array.isArray(r?.data)) setSuggestions(r.data as string[]);
  }
  return (
    <div>
      <label className="label">Custom alias</label>
      <div className="flex items-stretch">
        <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-bg px-3 text-sm text-muted whitespace-nowrap max-w-[45%] truncate">{prefix}/</span>
        <input className="input rounded-l-none" placeholder="my-link" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <span className="inline-flex items-center px-2 w-8 justify-center">
          {status === "checking" && <Loader2 size={14} className="animate-spin text-muted" />}
          {status === "ok" && <Check size={16} className="text-success" />}
          {(status === "taken" || status === "invalid") && <X size={16} className="text-danger" />}
        </span>
        {aiEnabled && <button type="button" className="btn-secondary btn-sm whitespace-nowrap" onClick={ai} disabled={aiBusy || !url}>{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Suggest</button>}
      </div>
      {status === "taken" && <p className="hint text-danger">This alias is already taken.</p>}
      {status === "invalid" && <p className="hint text-danger">Only letters, numbers, dashes and underscores.</p>}
      {status !== "taken" && status !== "invalid" && <p className="hint">{hint ?? "Leave empty to generate a random alias."}</p>}
      {aiError && <p className="hint text-danger">{aiError}</p>}
      {suggestions.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{suggestions.map((s) => <button key={s} type="button" className="badge-blue cursor-pointer" onClick={() => onChange(s)}>{s}</button>)}</div>}
    </div>
  );
}
