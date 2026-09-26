"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/ui";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { migrateBitly, migrateCsv, migrateRebrandly, previewCsv } from "./actions";

type Domain = { id: string; domain: string };
type LogRow = { row: number; alias?: string; url: string; status: "imported" | "skipped"; error?: string };

function CommonFields({ domains }: { domains: Domain[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="label">Domain</label><select name="domainId" className="input" defaultValue=""><option value="">Main domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</select></div>
      <div><label className="label">Tag imported links</label><input name="tag" className="input" placeholder="e.g. imported-bitly" /></div>
      <div><label className="label">Custom back-halves</label><select name="keepAliases" className="input" defaultValue="1"><option value="1">Keep as alias when available</option><option value="0">Always generate new aliases</option></select></div>
    </div>
  );
}

function ResultLog({ state }: { state: ActionState }) {
  const data = state?.ok ? (state.data as { log?: LogRow[] } | undefined) : undefined;
  if (!data?.log?.length) return null;
  const failed = data.log.filter((l) => l.status === "skipped");
  return (
    <details className="text-xs mt-3" open={failed.length > 0}>
      <summary className="cursor-pointer text-muted">{failed.length ? `${failed.length} rows skipped — show details` : "Show import log"}</summary>
      <div className="max-h-64 overflow-auto mt-2 rounded-lg border border-border">
        <table className="table"><thead><tr><th>#</th><th>Alias</th><th>URL</th><th>Result</th></tr></thead>
          <tbody>{data.log.map((l) => <tr key={l.row}><td>{l.row}</td><td className="font-mono">{l.alias ?? "-"}</td><td className="truncate max-w-xs" title={l.url}>{l.url}</td><td className={l.status === "imported" ? "text-success" : "text-danger"}>{l.status === "imported" ? "Imported" : l.error}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

export function MigrateForms({ domains }: { domains: Domain[] }) {
  const [tab, setTab] = useState("bitly");
  const router = useRouter();
  const [bitly, bitlyAction] = useActionState(async (p: ActionState, fd: FormData) => { const r = await migrateBitly(p, fd); if (r?.ok) router.refresh(); return r; }, null);
  const [rebrandly, rebrandlyAction] = useActionState(async (p: ActionState, fd: FormData) => { const r = await migrateRebrandly(p, fd); if (r?.ok) router.refresh(); return r; }, null);
  const [csv, csvAction] = useActionState(async (p: ActionState, fd: FormData) => { const r = await migrateCsv(p, fd); if (r?.ok) router.refresh(); return r; }, null);
  const [preview, setPreview] = useState<{ mapping: Record<string, string | null>; rows: { url: string; alias?: string | null; title?: string | null; clicks?: number }[] } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) { setPreview(null); return; }
    const fd = new FormData(); fd.append("file", f);
    const r = await previewCsv(fd);
    setPreview(r?.ok ? (r.data as typeof preview) : null);
  }

  return (
    <div>
      <Tabs tabs={[{ key: "bitly", label: "Bitly" }, { key: "rebrandly", label: "Rebrandly" }, { key: "csv", label: "CSV export" }]} value={tab} onChange={setTab} />
      {tab === "bitly" && (
        <form action={bitlyAction} className="space-y-4">
          <p className="text-sm text-muted">Generate a token at <span className="font-mono">app.bitly.com → Settings → Developer settings → API → Access token</span>. We read your groups and bitlinks, keep custom back-halves as aliases when they are free, and store total clicks as historic counts. Up to 500 links per run.</p>
          <div><label className="label">Bitly access token</label><input name="token" className="input font-mono" placeholder="e.g. 3f2a…" required autoComplete="off" /></div>
          <CommonFields domains={domains} />
          <FormMessage state={bitly} /><ResultLog state={bitly} />
          <SubmitButton>Import from Bitly</SubmitButton>
        </form>
      )}
      {tab === "rebrandly" && (
        <form action={rebrandlyAction} className="space-y-4">
          <p className="text-sm text-muted">Create an API key at <span className="font-mono">app.rebrandly.com → Account → API keys</span>. Slashtags become aliases when available; click counts are preserved. Up to 500 links per run.</p>
          <div><label className="label">Rebrandly API key</label><input name="apiKey" className="input font-mono" placeholder="e.g. 6b0c…" required autoComplete="off" /></div>
          <CommonFields domains={domains} />
          <FormMessage state={rebrandly} /><ResultLog state={rebrandly} />
          <SubmitButton>Import from Rebrandly</SubmitButton>
        </form>
      )}
      {tab === "csv" && (
        <form action={csvAction} className="space-y-4">
          <p className="text-sm text-muted">Upload the CSV export from Bitly, TinyURL, Rebrandly, Short.io or any other tool. Columns such as <span className="font-mono">long_url / destination / original</span>, <span className="font-mono">keyword / slashtag / alias</span>, <span className="font-mono">title</span> and <span className="font-mono">clicks</span> are detected automatically.</p>
          <div><label className="label">CSV file</label><input type="file" name="file" accept=".csv,text/csv" className="input" required onChange={onFile} /></div>
          {preview && (
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium mb-1">Detected columns</p>
              <p className="text-muted">{Object.entries(preview.mapping).map(([k, v]) => `${k}: ${v ?? "—"}`).join(" · ")}</p>
              {preview.rows.length > 0 && <table className="table mt-2"><thead><tr><th>URL</th><th>Alias</th><th>Title</th><th className="text-right">Clicks</th></tr></thead><tbody>{preview.rows.map((r, i) => <tr key={i}><td className="truncate max-w-xs">{r.url}</td><td className="font-mono">{r.alias ?? "-"}</td><td>{r.title ?? "-"}</td><td className="text-right">{r.clicks ?? 0}</td></tr>)}</tbody></table>}
            </div>
          )}
          <CommonFields domains={domains} />
          <FormMessage state={csv} /><ResultLog state={csv} />
          <SubmitButton>Import CSV</SubmitButton>
        </form>
      )}
    </div>
  );
}
