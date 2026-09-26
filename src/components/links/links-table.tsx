"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Pencil, QrCode, Archive, ArchiveRestore, Pin, PinOff, Copy, Trash2, Loader2, Download, ExternalLink, Tag } from "lucide-react";
import { Badge, CopyButton, Empty } from "@/components/ui";
import { formatDate, formatNumber, truncate, cn } from "@/lib/utils";
import { bulkLinks, deleteLink, duplicateLink, setArchived, setPinned, type BulkAction } from "@/app/dashboard/links/actions";

export interface LinkRow {
  id: string; alias: string; short: string; url: string; title: string | null; clicks: number; uniqueClicks: number; createdAt: string; status: string;
  isArchived: boolean; isPinned: boolean; redirectType: string; channel: { name: string; color: string } | null; campaign: { name: string } | null; domain: string | null; hasPassword: boolean; expired: boolean;
  tags?: string[]; scheduled?: boolean; healthStatus?: string;
}
export interface TablePerms { edit: boolean; delete: boolean; create: boolean; stats: boolean; export: boolean; pixels: boolean }

function StatusBadge({ row }: { row: LinkRow }) {
  if (row.isArchived) return <Badge color="gray">Archived</Badge>;
  if (row.expired) return <Badge color="yellow">Expired</Badge>;
  if (row.scheduled) return <Badge color="blue">Scheduled</Badge>;
  const map: Record<string, { c: "green" | "red" | "yellow" | "gray" | "blue"; l: string }> = { active: { c: "green", l: "Active" }, pending: { c: "yellow", l: "Pending" }, disabled: { c: "gray", l: "Disabled" }, blocked: { c: "red", l: "Blocked" } };
  const m = map[row.status] ?? { c: "gray" as const, l: row.status };
  return <Badge color={m.c}>{m.l}</Badge>;
}

export function LinksTable({ rows, channels, campaigns, pixels, tags = [], perms }: { rows: LinkRow[]; channels: { id: string; name: string; color: string }[]; campaigns: { id: string; name: string }[]; pixels: { id: string; name: string }[]; tags?: string[]; perms: TablePerms }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkAction>("channel");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkPixels, setBulkPixels] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected];

  function run(fn: () => Promise<{ ok?: boolean; error?: string; message?: string } | null | undefined>) {
    start(async () => {
      const r = await fn();
      setMsg(r?.error ? { ok: false, text: r.error } : r?.message ? { ok: true, text: r.message } : null);
      if (!r?.error) { setSelected(new Set()); router.refresh(); }
    });
  }
  function toggle(id: string) { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function applyBulk() {
    if (!ids.length) return;
    if (bulk === "delete" && !confirm(`Delete ${ids.length} link(s)? This cannot be undone.`)) return;
    run(() => bulkLinks(bulk, ids, bulk === "pixels" ? bulkPixels.join(",") : bulkValue));
  }

  if (!rows.length) return <Empty title="No links found" description="Try different filters or create your first short link." action={perms.create ? <Link href="/dashboard/links/new" className="btn-primary">Shorten a link</Link> : undefined} />;

  return (
    <div className="space-y-3">
      {msg && <div className={cn("rounded-lg px-4 py-2 text-sm", msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{msg.text}</div>}
      {ids.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{ids.length} selected</span>
          <select className="input !w-auto" value={bulk} onChange={(e) => { setBulk(e.target.value as BulkAction); setBulkValue(""); }}>
            {perms.edit && <option value="channel">Assign to channel</option>}
            {perms.edit && <option value="campaign">Assign to campaign</option>}
            {perms.edit && perms.pixels && <option value="pixels">Assign pixels</option>}
            {perms.edit && <option value="addTag">Add tag</option>}
            {perms.edit && <option value="removeTag">Remove tag</option>}
            {perms.edit && <option value="archive">Archive</option>}
            {perms.edit && <option value="unarchive">Unarchive</option>}
            {perms.delete && <option value="delete">Delete</option>}
          </select>
          {bulk === "channel" && <select className="input !w-auto" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">No channel</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          {bulk === "campaign" && <select className="input !w-auto" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">No campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          {(bulk === "addTag" || bulk === "removeTag") && <><input list="bulk-tags" className="input !w-auto" placeholder="Tag name" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /><datalist id="bulk-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist></>}
          {bulk === "pixels" && <div className="flex flex-wrap gap-1">{pixels.map((p) => <label key={p.id} className={cn("badge cursor-pointer border", bulkPixels.includes(p.id) ? "bg-primary/15 text-primary border-primary/30" : "border-border text-muted")}><input type="checkbox" className="hidden" checked={bulkPixels.includes(p.id)} onChange={(e) => setBulkPixels(e.target.checked ? [...bulkPixels, p.id] : bulkPixels.filter((x) => x !== p.id))} />{p.name}</label>)}{!pixels.length && <span className="text-muted">No pixels created yet</span>}</div>}
          <button type="button" className="btn-primary btn-sm" onClick={applyBulk} disabled={pending}>{pending ? <Loader2 size={14} className="animate-spin" /> : "Apply"}</button>
          {perms.export && <a className="btn-secondary btn-sm" href={`/api/links/export?ids=${ids.join(",")}`}><Download size={14} /> Export CSV</a>}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr>
            <th className="w-8"><input type="checkbox" checked={all} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
            <th>Link</th><th className="text-right">Clicks</th><th>Created</th><th>Status</th><th className="text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn(selected.has(r.id) && "bg-primary/5")}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="max-w-md">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.isPinned && <Pin size={12} className="text-primary shrink-0" />}
                    {r.channel && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.channel.color }} title={r.channel.name} />}
                    <a href={r.short} target="_blank" rel="noreferrer" className="font-medium text-primary truncate">{r.short.replace(/^https?:\/\//, "")}</a>
                    <CopyButton text={r.short} label="" className="!px-1.5" />
                  </div>
                  <p className="text-xs text-muted truncate mt-0.5" title={r.url}>{r.title ? <span className="text-fg">{truncate(r.title, 40)} · </span> : null}{truncate(r.url, 70)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.campaign && <span className="badge-blue">{r.campaign.name}</span>}
                    {r.redirectType !== "direct" && <span className="badge-gray capitalize">{r.redirectType}</span>}
                    {r.hasPassword && <span className="badge-gray">Password</span>}
                    {r.healthStatus === "broken" && <span className="badge-red">Broken</span>}
                    {(r.tags ?? []).map((t) => <Link key={t} href={`/dashboard/links?tag=${encodeURIComponent(t)}`} className="badge-gray hover:text-primary" title={`Filter by ${t}`}><Tag size={10} className="mr-0.5" />{t}</Link>)}
                  </div>
                </td>
                <td className="text-right font-medium whitespace-nowrap">{formatNumber(r.clicks)}<span className="block text-[11px] text-muted font-normal">{formatNumber(r.uniqueClicks)} unique</span></td>
                <td className="text-muted whitespace-nowrap text-xs">{formatDate(r.createdAt)}</td>
                <td><StatusBadge row={r} /></td>
                <td>
                  <div className="flex items-center justify-end gap-0.5">
                    {perms.stats && <Link href={`/dashboard/links/${r.id}`} className="btn-ghost btn-sm !px-2" title="Statistics"><BarChart3 size={15} /></Link>}
                    {perms.edit && <Link href={`/dashboard/links/${r.id}/edit`} className="btn-ghost btn-sm !px-2" title="Edit"><Pencil size={15} /></Link>}
                    <Link href={`/dashboard/qr/new?linkId=${r.id}`} className="btn-ghost btn-sm !px-2" title="QR code"><QrCode size={15} /></Link>
                    <a href={r.short} target="_blank" rel="noreferrer" className="btn-ghost btn-sm !px-2 hidden sm:inline-flex" title="Open"><ExternalLink size={15} /></a>
                    {perms.edit && <button type="button" className="btn-ghost btn-sm !px-2" title={r.isPinned ? "Unpin" : "Pin"} disabled={pending} onClick={() => run(() => setPinned(r.id, !r.isPinned))}>{r.isPinned ? <PinOff size={15} /> : <Pin size={15} />}</button>}
                    {perms.edit && <button type="button" className="btn-ghost btn-sm !px-2" title={r.isArchived ? "Unarchive" : "Archive"} disabled={pending} onClick={() => run(() => setArchived(r.id, !r.isArchived))}>{r.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button>}
                    {perms.create && <button type="button" className="btn-ghost btn-sm !px-2" title="Duplicate" disabled={pending} onClick={() => run(() => duplicateLink(r.id))}><Copy size={15} /></button>}
                    {perms.delete && <button type="button" className="btn-ghost btn-sm !px-2 text-danger" title="Delete" disabled={pending} onClick={() => { if (confirm("Delete this link? This cannot be undone.")) run(() => deleteLink(r.id)); }}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
