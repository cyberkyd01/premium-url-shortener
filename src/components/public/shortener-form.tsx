"use client";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/ui";
import { Captcha, type CaptchaConfig } from "./captcha";
import { BarChart3, Link2, Loader2, QrCode, Trash2 } from "lucide-react";

export interface ShortenerProps {
  loggedIn: boolean;
  domains: { id: string; domain: string }[];
  mainDomainUsable: boolean;
  mainHost: string;
  allowCustomAlias: boolean;
  redirectTypes: string[];
  captcha: CaptchaConfig | null;
  history: boolean;
}

interface Recent { id: string; short: string; alias: string; url: string; at: number }
interface ShortenResponse { error: number; message?: string; short?: string; alias?: string; id?: string }

const STORAGE_KEY = "recent-links";
const REDIRECT_LABELS: Record<string, string> = { direct: "Direct", frame: "Frame", splash: "Splash page", custom: "Custom splash", overlay: "Overlay" };

function readRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Recent[]).filter((r) => typeof r?.short === "string") : [];
  } catch {
    return [];
  }
}

export function ShortenerForm(p: ShortenerProps) {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [domainId, setDomainId] = useState("");
  const [redirectType, setRedirectType] = useState(p.redirectTypes[0] ?? "direct");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ short: string; alias: string; id: string } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => { if (p.history) setRecent(readRecent()); }, [p.history]);
  const onToken = useCallback((t: string) => setCaptchaToken(t), []);

  function remember(item: Recent) {
    if (!p.history) return;
    const next = [item, ...readRecent().filter((r) => r.id !== item.id)].slice(0, 10);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setRecent(next);
  }
  function clearRecent() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setRecent([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const body: Record<string, string> = { url: url.trim() };
      if (alias.trim()) body.alias = alias.trim();
      if (domainId) body.domainId = domainId;
      if (p.loggedIn && redirectType) body.redirectType = redirectType;
      if (captchaToken) body.captcha = captchaToken;
      const r = await fetch("/api/shorten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json()) as ShortenResponse;
      if (d.error || !d.short || !d.alias) {
        setError(d.message ?? "Could not shorten this link.");
      } else {
        const item = { id: d.id ?? d.alias, short: d.short, alias: d.alias, url: url.trim(), at: Date.now() };
        setResult(item);
        remember(item);
        setUrl(""); setAlias("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showAdvanced = p.allowCustomAlias || p.domains.length > 0 || (p.loggedIn && p.redirectTypes.length > 1);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={submit} className="card p-3 md:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9 py-3 text-base" placeholder="Paste your long URL here" value={url} onChange={(e) => setUrl(e.target.value)} required autoFocus inputMode="url" />
          </div>
          <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : "Shorten"}</button>
        </div>
        {showAdvanced && (
          <div>
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setAdvanced((v) => !v)}>{advanced ? "Hide options" : "More options"}</button>
            {advanced && (
              <div className="grid gap-2 sm:grid-cols-3 mt-2">
                {(p.domains.length > 0) && (
                  <select className="input" value={domainId} onChange={(e) => setDomainId(e.target.value)} aria-label="Domain">
                    {p.mainDomainUsable && <option value="">{p.mainHost}</option>}
                    {p.domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                  </select>
                )}
                {p.allowCustomAlias && <input className="input" placeholder="Custom alias (optional)" value={alias} onChange={(e) => setAlias(e.target.value)} pattern="[a-zA-Z0-9_-]{1,64}" title="Letters, numbers, dashes and underscores" />}
                {p.loggedIn && p.redirectTypes.length > 1 && (
                  <select className="input" value={redirectType} onChange={(e) => setRedirectType(e.target.value)} aria-label="Redirect type">
                    {p.redirectTypes.map((t) => <option key={t} value={t}>{REDIRECT_LABELS[t] ?? t}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        )}
        {p.captcha && <Captcha config={p.captcha} action="shorten" onToken={onToken} />}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {result && (
        <div className="card p-4 mt-4 animate-in">
          <div className="flex flex-wrap items-center gap-3">
            <a href={result.short} target="_blank" rel="noreferrer" className="text-primary font-semibold text-lg truncate flex-1 min-w-0">{result.short}</a>
            <CopyButton text={result.short} />
            <a className="btn-secondary btn-sm" href={`/api/qr/render?data=${encodeURIComponent(result.short)}`} target="_blank" rel="noreferrer"><QrCode size={14} /> QR code</a>
            <a className="btn-secondary btn-sm" href={`/stats/${encodeURIComponent(result.alias)}`}><BarChart3 size={14} /> Stats</a>
          </div>
        </div>
      )}

      {p.history && recent.length > 0 && (
        <div className="card mt-6 text-left">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Your recent links</h3>
            <button type="button" className="btn-ghost btn-sm" onClick={clearRecent}><Trash2 size={12} /> Clear</button>
          </div>
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <a href={r.short} target="_blank" rel="noreferrer" className="text-primary font-medium block truncate">{r.short}</a>
                  <span className="text-muted text-xs block truncate">{r.url}</span>
                </div>
                <CopyButton text={r.short} />
                <a className="btn-ghost btn-sm" href={`/stats/${encodeURIComponent(r.alias)}`}><BarChart3 size={12} /></a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
