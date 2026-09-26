import type { Metadata } from "next";
import Link from "next/link";
import { Code2, KeyRound, Webhook, Zap, Terminal, ShieldCheck, Clock, BookOpen, Play, FileJson } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { API_SECTIONS, CLIENT_LIBRARIES, PERMISSION_KEYS, WEBHOOK_EVENTS, curlFor, pretty, type ApiEndpoint, type ApiParam } from "@/lib/api-docs";
import { CRON_JOB_NAMES } from "@/lib/cron-runner";

export const metadata: Metadata = { title: "Developer API", description: "REST API reference, webhooks, Slack, bookmarklet and client libraries." };
export const dynamic = "force-dynamic";

const METHOD_COLORS: Record<string, string> = { GET: "bg-success/15 text-success", POST: "bg-primary/15 text-primary", PUT: "bg-warning/15 text-warning", DELETE: "bg-danger/15 text-danger" };

function Method({ m }: { m: string }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono ${METHOD_COLORS[m] ?? "bg-muted/15 text-muted"}`}>{m}</span>;
}

function Pre({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="bg-fg/5 dark:bg-black/40 rounded-lg p-4 overflow-auto text-xs leading-relaxed font-mono whitespace-pre" data-lang={lang}>
      <code>{children}</code>
    </pre>
  );
}

function ParamTable({ title, rows }: { title: string; rows?: ApiParam[] }) {
  if (!rows?.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{title}</div>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td className="font-mono text-xs whitespace-nowrap">{p.name}{p.required && <span className="text-danger ml-1" title="required">*</span>}</td>
                <td className="text-xs text-muted whitespace-nowrap">{p.type}</td>
                <td className="text-sm">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Endpoint({ e, base }: { e: ApiEndpoint; base: string }) {
  const id = `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <article id={id} className="card p-5 md:p-6 space-y-5 scroll-mt-24">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Method m={e.method} />
          <code className="font-mono text-sm md:text-base font-semibold break-all">{e.path}</code>
          {e.admin && <span className="badge-red">admin only</span>}
          {e.auth === "public" && <span className="badge-green">public</span>}
          {e.auth === "session-or-anonymous" && <span className="badge-blue">key · session · anonymous</span>}
        </div>
        <h3 className="text-lg font-semibold">{e.title}</h3>
        {e.description && <p className="text-sm text-muted">{e.description}</p>}
        {e.permission && <p className="text-xs text-muted">Requires permission <code className="font-mono bg-fg/5 px-1.5 py-0.5 rounded">{e.permission}</code></p>}
      </header>
      <ParamTable title="Query parameters" rows={e.query} />
      <ParamTable title="Body parameters" rows={e.params} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Example request</div>
          <Pre lang="bash">{curlFor(e, base)}</Pre>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Example response</div>
          <Pre lang="json">{pretty(e.example.response)}</Pre>
        </div>
      </div>
    </article>
  );
}

export default async function DevelopersPage() {
  const s = await getSettings();
  const base = appUrl();
  const rateLimit = s["api.rateLimit"] || "60";
  const siteName = s["site.name"];
  const nav = [
    { id: "auth", title: "Authentication" }, { id: "errors", title: "Errors & pagination" }, { id: "rate-limits", title: "Rate limits" }, { id: "permissions", title: "Permissions" },
    ...API_SECTIONS.map((x) => ({ id: x.id, title: x.title })),
    { id: "webhooks", title: "Webhooks" }, { id: "slack", title: "Slack" }, { id: "cron", title: "Cron jobs" }, { id: "clients", title: "Client libraries" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 md:py-14">
      <div className="mb-10 md:mb-14">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3"><Code2 size={16} /> Developer API v1</div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Build with {siteName}</h1>
        <p className="mt-4 text-muted max-w-2xl text-lg">A REST API for short links, campaigns, QR codes, bio pages, domains and more, plus webhooks, a Slack command, a WordPress plugin, a Chrome extension and ready-made client libraries.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/settings" className="btn-primary"><KeyRound size={16} /> Get your API key</Link>
          <a href="#links" className="btn-secondary"><Terminal size={16} /> Jump to endpoints</a>
          <Link href="/developers/playground" className="btn-secondary"><Play size={16} /> Open playground</Link>
          <a href="/api/v1/openapi.json" download="openapi.json" className="btn-secondary"><FileJson size={16} /> Download OpenAPI spec</a>
          {s["api.enabled"] !== "1" && <span className="badge-yellow self-center">The API is currently disabled by the administrator</span>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {nav.map((n) => <a key={n.id} href={`#${n.id}`} className="nav-item">{n.title}</a>)}
          </nav>
        </aside>

        <div className="space-y-12 min-w-0">
          <section id="auth" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck size={22} className="text-primary" /> Authentication</h2>
            <p className="text-muted">Every <code className="font-mono text-sm">/api/v1</code> request must carry an API key. Create and scope keys under <Link href="/dashboard/settings" className="text-primary underline">Dashboard → Settings → API</Link>. Keys are sent as a bearer token; <code className="font-mono text-sm">?key=</code> works as a fallback for GET requests.</p>
            <Pre lang="bash">{`curl "${base}/api/v1/account" \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}</Pre>
            <p className="text-sm text-muted">Base URL: <code className="font-mono">{base}</code>. API access must be part of your plan; administrators always have access.</p>
          </section>

          <section id="errors" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-bold">Response format, errors &amp; pagination</h2>
            <p className="text-muted">Successful calls return <code className="font-mono text-sm">{`{ "error": 0, ... }`}</code>; failures return <code className="font-mono text-sm">{`{ "error": 1, "message": "..." }`}</code> with a matching HTTP status.</p>
            <div className="overflow-auto rounded-lg border border-border">
              <table className="table">
                <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                <tbody>
                  {[["400", "Validation error – the message explains what to fix"], ["401", "Missing or invalid API key"], ["402", "Plan limit reached or feature not included in your plan"], ["403", "Permission denied – key lacks the permission, admin only, or inactive account"], ["404", "Resource not found"], ["409", "Conflict – alias or slug already taken"], ["429", "Rate limit exceeded"], ["503", "API disabled by the administrator"]].map(([c, m]) => (
                    <tr key={c}><td className="font-mono text-xs">{c}</td><td className="text-sm">{m}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted text-sm">List endpoints accept <code className="font-mono">?page=</code> and <code className="font-mono">?limit=</code> (max 100) and respond with:</p>
            <Pre lang="json">{pretty({ error: 0, data: ["..."], pagination: { page: 1, limit: 25, total: 240, pages: 10 } })}</Pre>
          </section>

          <section id="rate-limits" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Clock size={22} className="text-primary" /> Rate limits</h2>
            <p className="text-muted">Each API key may perform <strong className="text-fg">{rateLimit} requests per minute</strong>. Exceeding it returns <code className="font-mono text-sm">429</code>; wait for the next minute window. Anonymous <code className="font-mono text-sm">/api/shorten</code> calls are limited to 20 per minute per IP address.</p>
          </section>

          <section id="permissions" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Key permissions</h2>
            <p className="text-muted">When creating a key you can restrict it to specific permissions. <code className="font-mono text-sm">*</code> grants everything and <code className="font-mono text-sm">links.*</code> grants every link permission. Every endpoint below lists what it requires.</p>
            <div className="flex flex-wrap gap-2">{PERMISSION_KEYS.map((p) => <code key={p} className="font-mono text-xs bg-fg/5 border border-border rounded px-2 py-1">{p}</code>)}</div>
          </section>

          {API_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 space-y-5">
              <div>
                <h2 className="text-2xl font-bold">{section.title}</h2>
                {section.description && <p className="text-muted mt-1">{section.description}</p>}
              </div>
              <div className="space-y-5">{section.endpoints.map((e) => <Endpoint key={e.method + e.path} e={e} base={base} />)}</div>
            </section>
          ))}

          <section id="webhooks" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Webhook size={22} className="text-primary" /> Webhooks &amp; Zapier</h2>
            <p className="text-muted">Create webhooks under <Link href="/dashboard/tools" className="text-primary underline">Dashboard → Tools</Link> or connect Zapier and choose the events you need. Every event is delivered as a JSON <code className="font-mono text-sm">POST</code>; when a secret is set the <code className="font-mono text-sm">X-Signature</code> header contains <code className="font-mono text-sm">hex(HMAC-SHA256(secret, body))</code>.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {WEBHOOK_EVENTS.map((w) => (
                <div key={w.event} className="card p-5 space-y-3">
                  <div className="flex items-center gap-2"><Zap size={16} className="text-primary" /><code className="font-mono font-semibold">{w.event}</code></div>
                  <p className="text-sm text-muted">{w.description}</p>
                  <Pre lang="json">{pretty(w.payload)}</Pre>
                </div>
              ))}
            </div>
          </section>

          <section id="slack" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Slack slash command</h2>
            <p className="text-muted">Administrators enable Slack under Settings → Integrations and register a slash command whose Request URL is <code className="font-mono text-sm break-all">{base}/api/webhook/slack</code>. Each user connects their Slack identity once under <Link href="/dashboard/tools" className="text-primary underline">Dashboard → Tools</Link> (the command replies with the team and user ids to paste). Then:</p>
            <Pre lang="bash">{`/shorten https://example.com/very/long/url my-alias`}</Pre>
          </section>

          <section id="cron" className="scroll-mt-24 space-y-3">
            <h2 className="text-2xl font-bold">Cron jobs (self-hosting)</h2>
            <p className="text-muted">Housekeeping jobs live under <code className="font-mono text-sm">/api/cron/&lt;job&gt;</code> and require <code className="font-mono text-sm">Authorization: Bearer $CRON_SECRET</code> (or <code className="font-mono text-sm">?secret=</code>). <code className="font-mono text-sm">GET /api/cron</code> runs them all; <code className="font-mono text-sm">pnpm cron</code> does the same from a shell or Docker sidecar.</p>
            <div className="flex flex-wrap gap-2">{CRON_JOB_NAMES.map((j) => <code key={j} className="font-mono text-xs bg-fg/5 border border-border rounded px-2 py-1">{j}</code>)}</div>
            <Pre lang="bash">{`*/10 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" ${base}/api/cron >/dev/null`}</Pre>
          </section>

          <section id="clients" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={22} className="text-primary" /> Client libraries &amp; integrations</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {CLIENT_LIBRARIES.map((c) => (
                <div key={c.name} className="card p-5 space-y-3">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted font-mono break-all">{c.path}</div>
                  <Pre>{c.snippet}</Pre>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">All integrations ship in the <code className="font-mono">integrations/</code> folder of the source package. The full reference is also available as Markdown in <code className="font-mono">docs/API.md</code>, as an <a href="/api/v1/openapi.json" className="text-primary underline">OpenAPI 3.1 document</a> (import it into Postman, Insomnia or code generators) and as an interactive <Link href="/developers/playground" className="text-primary underline">API playground</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
