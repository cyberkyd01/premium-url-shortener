"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, Send, Zap, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { CopyButton } from "@/components/ui";
import type { NormalizedParam, PlaygroundEndpoint } from "@/lib/openapi";

const STORAGE_KEY = "pus.playground.apiKey";
const METHOD_COLORS: Record<string, string> = { GET: "bg-success/15 text-success", POST: "bg-primary/15 text-primary", PUT: "bg-warning/15 text-warning", DELETE: "bg-danger/15 text-danger" };
const PRESET_ID = "POST /api/v1/links";

type Values = Record<string, string>;
interface Result { status: number; statusText: string; ms: number; body: string; contentType: string; url: string }

function fieldKind(type: string): "boolean" | "number" | "string" | "json" {
  const t = type.toLowerCase();
  if (t === "boolean") return "boolean";
  if (t === "number" || t === "integer") return "number";
  if (t === "string") return "string";
  return "json";
}

/** Converts a form string into the JSON value the API expects for the parameter type. */
function coerce(p: NormalizedParam, raw: string): unknown {
  const kind = fieldKind(p.type);
  if (kind === "boolean") return raw === "true";
  if (kind === "number") { const n = Number(raw); return Number.isFinite(n) ? n : raw; }
  if (kind === "string") return raw;
  try { return JSON.parse(raw) as unknown; } catch { return raw; }
}

function stringify(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function initialValues(params: NormalizedParam[], example: unknown): Values {
  const out: Values = {};
  const ex = typeof example === "object" && example !== null && !Array.isArray(example) ? (example as Record<string, unknown>) : {};
  for (const p of params) if (p.name in ex) out[p.name] = stringify(ex[p.name]);
  return out;
}

function shellQuote(s: string) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function ApiPlayground({ endpoints, base }: { endpoints: PlaygroundEndpoint[]; base: string }) {
  const [apiKey, setApiKey] = useState("");
  const [selectedId, setSelectedId] = useState(endpoints[0]?.id ?? "");
  const [pathValues, setPathValues] = useState<Values>({});
  const [queryValues, setQueryValues] = useState<Values>({});
  const [bodyValues, setBodyValues] = useState<Values>({});
  const [rawMode, setRawMode] = useState(false);
  const [rawBody, setRawBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [origin, setOrigin] = useState(base);

  const endpoint = useMemo(() => endpoints.find((e) => e.id === selectedId) ?? endpoints[0], [endpoints, selectedId]);
  const groups = useMemo(() => {
    const map = new Map<string, PlaygroundEndpoint[]>();
    for (const e of endpoints) { const list = map.get(e.sectionTitle) ?? []; list.push(e); map.set(e.sectionTitle, list); }
    return Array.from(map.entries());
  }, [endpoints]);

  useEffect(() => {
    try { const k = window.localStorage.getItem(STORAGE_KEY); if (k) setApiKey(k); } catch { /* storage unavailable */ }
    setOrigin(window.location.origin);
  }, []);

  const saveKey = (k: string) => {
    setApiKey(k);
    try { if (k) window.localStorage.setItem(STORAGE_KEY, k); else window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const selectEndpoint = (id: string, overrides?: { body?: Values }) => {
    const e = endpoints.find((x) => x.id === id);
    if (!e) return;
    setSelectedId(id);
    setPathValues(Object.fromEntries(e.pathParams.map((p) => [p, ""])));
    setQueryValues({ ...(e.exampleQuery ?? {}) });
    setBodyValues(overrides?.body ?? initialValues(e.body, e.exampleBody));
    setRawMode(false);
    setRawBody("");
    setResult(null);
    setError("");
  };

  const hasBody = !!endpoint && (endpoint.body.length > 0 || endpoint.exampleBody !== undefined);

  const buildBody = (): { body?: string; error?: string } => {
    if (!endpoint || !hasBody) return {};
    if (rawMode) {
      if (!rawBody.trim()) return {};
      try { JSON.parse(rawBody); return { body: rawBody }; } catch { return { error: "The raw body is not valid JSON." }; }
    }
    const obj: Record<string, unknown> = {};
    for (const p of endpoint.body) { const v = bodyValues[p.name]; if (v !== undefined && v !== "") obj[p.name] = coerce(p, v); }
    return Object.keys(obj).length ? { body: JSON.stringify(obj) } : {};
  };

  const buildUrl = () => {
    if (!endpoint) return "";
    let path = endpoint.path;
    for (const p of endpoint.pathParams) path = path.replace(`:${p}`, encodeURIComponent(pathValues[p] || `:${p}`));
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(queryValues)) if (v !== "") qs.set(k, v);
    const q = qs.toString();
    return `${origin}${path}${q ? `?${q}` : ""}`;
  };

  const toRawMode = () => {
    const b = buildBody();
    setRawBody(b.body ? JSON.stringify(JSON.parse(b.body), null, 2) : "{\n  \n}");
    setRawMode(true);
  };

  const curl = useMemo(() => {
    if (!endpoint) return "";
    const lines = [`curl -X ${endpoint.method} ${shellQuote(buildUrl())}`];
    if (endpoint.auth !== "public") lines.push(`  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}"`);
    const b = buildBody();
    if (b.body) lines.push(`  -H "Content-Type: application/json"`, `  -d ${shellQuote(b.body)}`);
    return lines.join(" \\\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, apiKey, pathValues, queryValues, bodyValues, rawMode, rawBody, origin]);

  async function send() {
    if (!endpoint) return;
    const missing = endpoint.pathParams.filter((p) => !pathValues[p]);
    if (missing.length) { setError(`Fill in the path parameter${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`); return; }
    const b = buildBody();
    if (b.error) { setError(b.error); return; }
    if (endpoint.method === "DELETE" && !window.confirm("This sends a real DELETE request to your account. Continue?")) return;
    setBusy(true); setError(""); setResult(null);
    const url = buildUrl();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey && endpoint.auth !== "public") headers.Authorization = `Bearer ${apiKey}`;
    if (b.body) headers["Content-Type"] = "application/json";
    const started = performance.now();
    try {
      const res = await fetch(url, { method: endpoint.method, headers, body: b.body, credentials: "same-origin" });
      const ms = Math.round(performance.now() - started);
      const contentType = res.headers.get("content-type") ?? "";
      const text = await res.text();
      let body = text;
      if (contentType.includes("json")) { try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep text */ } }
      else if (text.length > 20_000) body = text.slice(0, 20_000) + "\n… (truncated)";
      setResult({ status: res.status, statusText: res.statusText, ms, body, contentType, url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally { setBusy(false); }
  }

  if (!endpoint) return <p className="text-muted">No endpoints available.</p>;

  const statusColor = result ? (result.status < 300 ? "text-success" : result.status < 500 ? "text-warning" : "text-danger") : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5 min-w-0">
        <div className="card p-5 space-y-3">
          <label className="label flex items-center gap-2"><KeyRound size={14} /> API key</label>
          <input className="input font-mono" type="password" autoComplete="off" value={apiKey} onChange={(e) => saveKey(e.target.value)} placeholder="Paste an API key (stored only in this browser)" />
          <p className="hint">Create keys under <Link href="/dashboard/settings" className="text-primary underline">Dashboard → Settings → API</Link>. The key stays in your browser&apos;s local storage and is sent only to <code className="font-mono">{origin}</code>.</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0">Endpoint</label>
            <button type="button" className="btn-secondary btn-sm" onClick={() => selectEndpoint(PRESET_ID, { body: { url: "https://example.com/spring-sale" } })}><Zap size={14} /> Try: shorten a link</button>
          </div>
          <select className="input font-mono text-sm" value={endpoint.id} onChange={(e) => selectEndpoint(e.target.value)}>
            {groups.map(([title, list]) => (
              <optgroup key={title} label={title}>{list.map((e) => <option key={e.id} value={e.id}>{e.method} {e.path} — {e.title}</option>)}</optgroup>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono ${METHOD_COLORS[endpoint.method] ?? ""}`}>{endpoint.method}</span>
            <code className="font-mono break-all">{endpoint.path}</code>
            {endpoint.admin && <span className="badge-red">admin only</span>}
            {endpoint.auth === "public" && <span className="badge-green">public</span>}
            {endpoint.permission && <span className="badge-gray font-mono">{endpoint.permission}</span>}
          </div>
          {endpoint.description && <p className="text-sm text-muted">{endpoint.description}</p>}

          {endpoint.pathParams.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Path parameters</legend>
              {endpoint.pathParams.map((p) => (
                <div key={p}>
                  <label className="label font-mono">{p}<span className="text-danger ml-1">*</span></label>
                  <input className="input font-mono" value={pathValues[p] ?? ""} onChange={(e) => setPathValues((v) => ({ ...v, [p]: e.target.value }))} placeholder={p === "id" ? "id or alias" : p} />
                </div>
              ))}
            </fieldset>
          )}

          {endpoint.query.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Query parameters</legend>
              {endpoint.query.map((p) => <ParamField key={p.name} p={p} value={queryValues[p.name] ?? ""} onChange={(v) => setQueryValues((s) => ({ ...s, [p.name]: v }))} />)}
            </fieldset>
          )}

          {hasBody && (
            <fieldset className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">JSON body</legend>
                {rawMode
                  ? <button type="button" className="btn-ghost btn-sm" onClick={() => setRawMode(false)}><RotateCcw size={12} /> Back to form</button>
                  : <button type="button" className="btn-ghost btn-sm" onClick={toRawMode}>Edit raw JSON</button>}
              </div>
              {rawMode
                ? <textarea className="input font-mono text-xs min-h-48" value={rawBody} onChange={(e) => setRawBody(e.target.value)} spellCheck={false} />
                : endpoint.body.length
                  ? endpoint.body.map((p) => <ParamField key={p.name} p={p} value={bodyValues[p.name] ?? ""} onChange={(v) => setBodyValues((s) => ({ ...s, [p.name]: v }))} />)
                  : <p className="hint">This endpoint accepts the same fields as the matching create endpoint. Use &quot;Edit raw JSON&quot; to write the body.</p>}
            </fieldset>
          )}

          {error && <div className="flex items-start gap-2 rounded-lg bg-danger/10 text-danger text-sm px-4 py-3"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={send}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send request</button>
            {!apiKey && endpoint.auth === "key" && <span className="text-xs text-warning">No API key set – the request will be rejected with 401.</span>}
          </div>
        </div>
      </div>

      <div className="space-y-5 min-w-0">
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Response</h3>
            {result && <div className="flex items-center gap-3 text-sm"><span className={`font-mono font-bold ${statusColor}`}>{result.status} {result.statusText}</span><span className="text-muted">{result.ms} ms</span><CopyButton text={result.body} label="Copy" /></div>}
          </div>
          {result
            ? <pre className="bg-fg/5 dark:bg-black/40 rounded-lg p-4 overflow-auto text-xs leading-relaxed font-mono whitespace-pre max-h-[32rem]"><code>{result.body || "(empty body)"}</code></pre>
            : <p className="text-sm text-muted">Send a request to see the status, timing and JSON response here.</p>}
          {result && <p className="hint break-all">{endpoint.method} {result.url}</p>}
        </div>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">cURL</h3>
            <CopyButton text={curl} label="Copy" />
          </div>
          <pre className="bg-fg/5 dark:bg-black/40 rounded-lg p-4 overflow-auto text-xs leading-relaxed font-mono whitespace-pre"><code>{curl}</code></pre>
        </div>
      </div>
    </div>
  );
}

function ParamField({ p, value, onChange }: { p: NormalizedParam; value: string; onChange: (v: string) => void }) {
  const kind = fieldKind(p.type);
  const label = <label className="label font-mono">{p.name}{p.required && <span className="text-danger ml-1">*</span>}<span className="ml-2 text-[10px] font-sans text-muted">{p.type}</span></label>;
  return (
    <div>
      {label}
      {kind === "boolean" ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">(omit)</option><option value="true">true</option><option value="false">false</option>
        </select>
      ) : kind === "json" ? (
        <textarea className="input font-mono text-xs min-h-16" value={value} onChange={(e) => onChange(e.target.value)} placeholder={p.type.includes("array") || p.type.endsWith("[]") ? "[ … ]" : "{ … }"} spellCheck={false} />
      ) : (
        <input className="input" type={kind === "number" ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <p className="hint">{p.description}</p>
    </div>
  );
}
