"use client";
import { useEffect, useState } from "react";
import { Inbox, CreateMailboxForm, type MailboxInfo } from "@/components/tempmail/inbox";

const KEY = "tempmail.guest";

function load(): MailboxInfo | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as MailboxInfo) : null; } catch { return null; }
}
function save(m: MailboxInfo | null) {
  try { if (m) localStorage.setItem(KEY, JSON.stringify(m)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Guest inbox: the mailbox token lives in localStorage so the visitor can come back to it. */
export function GuestTempMail({ domains }: { domains: string[] }) {
  const [mailbox, setMailbox] = useState<MailboxInfo | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const m = load();
    if (m && new Date(m.expiresAt).getTime() > Date.now()) {
      fetch(`/api/tempmail/${encodeURIComponent(m.token)}`, { cache: "no-store" }).then((r) => { if (r.ok) setMailbox(m); else save(null); }).catch(() => setMailbox(m)).finally(() => setReady(true));
    } else { save(null); setReady(true); }
  }, []);
  const set = (m: MailboxInfo | null) => { setMailbox(m); save(m); };
  if (!ready) return <div className="card p-8 text-center text-sm text-muted max-w-lg mx-auto">Loading…</div>;
  if (!mailbox) return <div className="max-w-lg mx-auto"><CreateMailboxForm domains={domains} allowCustom={false} onCreated={set} /></div>;
  return (
    <div className="max-w-5xl mx-auto">
      <Inbox mailbox={mailbox} onExpired={() => set(null)} onExtended={(expiresAt) => set({ ...mailbox, expiresAt })} onDeleted={() => set(null)} />
      <p className="text-xs text-muted text-center mt-3">Bookmark this page: your inbox is remembered in this browser until it expires.</p>
    </div>
  );
}
