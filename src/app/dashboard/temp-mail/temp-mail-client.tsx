"use client";
import { useState } from "react";
import { Button, Badge, Empty } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Inbox, CreateMailboxForm, Countdown, type MailboxInfo } from "@/components/tempmail/inbox";
import { Mail, Trash2 } from "lucide-react";

type Row = MailboxInfo & { unread: number; total: number };

export function TempMailDashboard({ domains, max, initial }: { domains: string[]; max: number; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const remove = async (r: Row) => {
    if (!window.confirm(`Delete ${r.address}?`)) return;
    await fetch(`/api/tempmail/${encodeURIComponent(r.token)}`, { method: "DELETE" });
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    if (activeId === r.id) setActiveId(null);
  };
  return (
    <div className="space-y-4">
      {rows.length < max ? <CreateMailboxForm domains={domains} allowCustom onCreated={(m) => { setRows((rs) => [{ ...m, unread: 0, total: 0 }, ...rs]); setActiveId(m.id); }} /> : <p className="text-sm text-muted">You reached the limit of {max} active inboxes. Delete one to create another.</p>}
      <div className="grid lg:grid-cols-[18rem_1fr] gap-4 items-start">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Your inboxes <span className="text-muted font-normal">({rows.length}/{max})</span></div>
          {rows.length === 0 ? <Empty title="No inboxes yet" description="Create a disposable address above." /> : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className={cn("flex items-center gap-2 px-3 py-2.5", activeId === r.id && "bg-primary/5")}>
                  <button type="button" onClick={() => setActiveId(r.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5"><Mail size={13} className="text-primary shrink-0" />{r.address}</p>
                    <p className="flex items-center gap-2 mt-0.5"><Countdown expiresAt={r.expiresAt} />{r.unread > 0 && <Badge color="blue">{r.unread} new</Badge>}</p>
                  </button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => void remove(r)} title="Delete"><Trash2 size={13} /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          {active ? (
            <Inbox key={active.id} mailbox={active} onExtended={(expiresAt) => setRows((rs) => rs.map((x) => (x.id === active.id ? { ...x, expiresAt } : x)))} onDeleted={() => { setRows((rs) => rs.filter((x) => x.id !== active.id)); setActiveId(null); }} />
          ) : <div className="card p-10 text-center text-sm text-muted">Select or create an inbox to view its messages.</div>}
        </div>
      </div>
    </div>
  );
}
