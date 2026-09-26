"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Download, Pencil, Trash2, Search, CheckSquare, Square, FolderInput, Loader2 } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { QR_TYPES } from "@/lib/qr-types";
import { Badge, Empty } from "@/components/ui";
import { bulkDeleteQr, bulkAssignChannel } from "@/app/dashboard/qr/actions";

export interface QrRow { id: string; name: string; type: string; scans: number; isDynamic: boolean; channel: { id: string; name: string; color: string } | null; createdAt: string; thumb: string; payload: string }

export function QrList({ rows, channels, canDelete, canEdit }: { rows: QrRow[]; channels: { id: string; name: string }[]; canDelete: boolean; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const list = useMemo(() => rows.filter((r) => (!type || r.type === type) && (!q || r.name.toLowerCase().includes(q.toLowerCase()) || r.payload.toLowerCase().includes(q.toLowerCase()))), [rows, q, type]);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSel = list.length > 0 && list.every((r) => sel.has(r.id));
  const ids = [...sel];

  const downloadZip = (format: "png" | "svg") => {
    const a = document.createElement("a"); a.href = `/api/qr/bulk-download?ids=${encodeURIComponent(ids.join(","))}&format=${format}`; a.download = "qr-codes.zip"; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-52"><Search size={15} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Search QR codes" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{QR_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</select>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setSel(allSel ? new Set() : new Set(list.map((r) => r.id)))}>{allSel ? <CheckSquare size={14} /> : <Square size={14} />}{allSel ? "Unselect all" : "Select all"}</button>
      </div>
      {ids.length > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{ids.length} selected</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => downloadZip("png")}><Download size={14} />Download ZIP (PNG)</button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => downloadZip("svg")}><Download size={14} />Download ZIP (SVG)</button>
          {canEdit && <select className="input w-auto text-xs" defaultValue="" onChange={(e) => { const v = e.target.value; if (v === "") return; start(async () => { const r = await bulkAssignChannel(ids, v === "none" ? null : v); setMsg(r.ok ? "Channel updated" : r.error ?? "Failed"); }); e.target.value = ""; }}>
            <option value="">Assign channel…</option><option value="none">No channel</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>}
          {canDelete && <button type="button" className="btn-danger btn-sm" disabled={pending} onClick={() => { if (!confirm(`Delete ${ids.length} QR codes?`)) return; start(async () => { const r = await bulkDeleteQr(ids); setMsg(r.ok ? "Deleted" : r.error ?? "Failed"); setSel(new Set()); }); }}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}Delete</button>}
          {msg && <span className="text-muted text-xs">{msg}</span>}
        </div>
      )}
      {!list.length ? <div className="card"><Empty title={rows.length ? "No QR codes match your filters" : "No QR codes yet"} description={rows.length ? undefined : "Create your first QR code to start tracking scans."} /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((r) => (
            <div key={r.id} className={cn("card p-4 flex flex-col gap-3 relative", sel.has(r.id) && "ring-2 ring-primary")}>
              <button type="button" className="absolute left-3 top-3 text-muted hover:text-fg" onClick={() => toggle(r.id)} aria-label="Select">{sel.has(r.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}</button>
              <Link href={`/dashboard/qr/${r.id}`} className="mx-auto"><img src={r.thumb} alt={r.name} className="h-32 w-32 object-contain rounded-lg bg-white" loading="lazy" /></Link>
              <div className="min-w-0">
                <Link href={`/dashboard/qr/${r.id}`} className="font-semibold truncate block hover:underline">{r.name}</Link>
                <p className="text-xs text-muted truncate">{r.payload}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge>{QR_TYPES.find((t) => t.type === r.type)?.label ?? r.type}</Badge>
                  {r.isDynamic ? <Badge color="blue">Dynamic</Badge> : <Badge color="gray">Static</Badge>}
                  {r.channel && <span className="badge-gray flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: r.channel.color }} />{r.channel.name}</span>}
                  <span className="text-xs text-muted ml-auto">{formatNumber(r.scans)} scans</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-auto">
                <Link href={`/dashboard/qr/${r.id}`} className="btn-secondary btn-sm"><BarChart3 size={14} />Stats</Link>
                {canEdit && <Link href={`/dashboard/qr/${r.id}/edit`} className="btn-secondary btn-sm"><Pencil size={14} />Edit</Link>}
                <a href={`/api/qr/${r.id}/download?format=png`} className="btn-ghost btn-sm" title="Download PNG"><Download size={14} /></a>
                {canEdit && <button type="button" className="btn-ghost btn-sm" title="Assign channel" onClick={() => setSel(new Set([r.id]))}><FolderInput size={14} /></button>}
                {canDelete && <button type="button" className="btn-ghost btn-sm text-danger ml-auto" title="Delete" onClick={() => { if (confirm("Delete this QR code?")) start(async () => { await bulkDeleteQr([r.id]); }); }}><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
