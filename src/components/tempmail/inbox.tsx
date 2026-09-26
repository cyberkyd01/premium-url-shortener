"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, CopyButton, Badge, Alert } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ArrowLeft, Clock, Inbox as InboxIcon, Mail, MailOpen, Paperclip, RefreshCw, Trash2, TimerReset } from "lucide-react";

export interface MailboxInfo { id: string; address: string; token: string; expiresAt: string }
export interface MessageRow { id: string; from: string; fromName: string | null; subject: string | null; read: boolean; receivedAt: string; preview: string; attachments: { name: string; size?: number; type?: string }[] }
export interface MessageFull extends MessageRow { text: string | null; html: string | null }

export function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000), sec = Math.floor((left % 60_000) / 1000);
  const label = left <= 0 ? "expired" : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(sec).padStart(2, "0")}`;
  return { left, label, expired: left <= 0 };
}

export function Countdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const { label, expired } = useCountdown(expiresAt);
  return <span className={cn("inline-flex items-center gap-1 text-xs", expired ? "text-danger" : "text-muted", className)}><Clock size={12} />{label}</span>;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inbox for one mailbox: polls messages every 10 seconds, opens messages in a sandboxed iframe. */
export function Inbox({ mailbox, onExpired, onExtended, onDeleted, pollMs = 10_000 }: { mailbox: MailboxInfo; onExpired?: () => void; onExtended?: (expiresAt: string) => void; onDeleted?: () => void; pollMs?: number }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [open, setOpen] = useState<MessageFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"html" | "text">("html");
  const { expired } = useCountdown(mailbox.expiresAt);
  const base = `/api/tempmail/${encodeURIComponent(mailbox.token)}`;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${base}/messages`, { cache: "no-store" });
      if (r.status === 404) { setError("This inbox has expired."); onExpired?.(); return; }
      const d = (await r.json()) as { messages?: MessageRow[]; error?: string };
      if (d.error) { setError(d.error); return; }
      setMessages(d.messages ?? []);
      setError("");
    } catch { setError("Could not reach the server"); } finally { setLoading(false); }
  }, [base, onExpired]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const openMessage = async (id: string) => {
    setBusy(true);
    try {
      const r = await fetch(`${base}/messages/${id}`, { cache: "no-store" });
      const d = (await r.json()) as { message?: MessageFull; error?: string };
      if (d.message) { setOpen(d.message); setView(d.message.html ? "html" : "text"); setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read: true } : m))); }
      else setError(d.error ?? "Could not load the message");
    } finally { setBusy(false); }
  };
  const toggleRead = async (id: string, read: boolean) => {
    await fetch(`${base}/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ read }) });
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read } : m)));
    if (open?.id === id) setOpen({ ...open, read });
  };
  const remove = async (id: string) => {
    await fetch(`${base}/messages/${id}`, { method: "DELETE" });
    setMessages((ms) => ms.filter((m) => m.id !== id));
    if (open?.id === id) setOpen(null);
  };
  const extend = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${base}/extend`, { method: "POST" });
      const d = (await r.json()) as { expiresAt?: string; error?: string };
      if (d.expiresAt) onExtended?.(d.expiresAt); else if (d.error) setError(d.error);
    } finally { setBusy(false); }
  };
  const deleteMailbox = async () => {
    if (!window.confirm("Delete this inbox and all its messages?")) return;
    await fetch(base, { method: "DELETE" });
    onDeleted?.();
  };

  const srcdoc = useMemo(() => {
    if (!open) return "";
    const body = view === "html" && open.html ? open.html : `<pre style="white-space:pre-wrap;font:14px/1.5 ui-sans-serif,system-ui,sans-serif">${escapeHtml(open.text ?? "")}</pre>`;
    return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:16px;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#fff}img{max-width:100%}</style></head><body>${body}</body></html>`;
  }, [open, view]);

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-bg/50">
        <Mail size={16} className="text-primary" />
        <code className="font-mono text-sm font-medium break-all">{mailbox.address}</code>
        <CopyButton text={mailbox.address} label="Copy" />
        <div className="flex-1" />
        <Countdown expiresAt={mailbox.expiresAt} />
        <Button variant="ghost" size="sm" onClick={() => void refresh()} title="Refresh"><RefreshCw size={14} className={cn(loading && "animate-spin")} /></Button>
        <Button variant="secondary" size="sm" onClick={extend} disabled={busy} title="Extend lifetime"><TimerReset size={14} />Extend</Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={deleteMailbox} title="Delete inbox"><Trash2 size={14} /></Button>
      </div>
      {expired && <div className="px-4 pt-3"><Alert type="warning">This inbox has expired. Extend it to keep receiving mail, or create a new one.</Alert></div>}
      {error && !expired && <div className="px-4 pt-3"><Alert type="error">{error}</Alert></div>}
      <div className="grid md:grid-cols-[minmax(0,18rem)_1fr] min-h-[24rem]">
        <ul className={cn("divide-y divide-border md:border-r border-border overflow-y-auto max-h-[32rem]", open && "hidden md:block")}>
          {loading && messages.length === 0 && <li className="p-6 text-sm text-muted text-center">Loading…</li>}
          {!loading && messages.length === 0 && (
            <li className="p-8 text-center text-sm text-muted"><InboxIcon size={28} className="mx-auto mb-2 opacity-60" />Waiting for incoming mail…<br /><span className="text-xs">Send an email to {mailbox.address}. Messages appear automatically.</span></li>
          )}
          {messages.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => void openMessage(m.id)} className={cn("w-full text-left px-4 py-3 hover:bg-bg/60 transition", open?.id === m.id && "bg-primary/5", !m.read && "bg-primary/[0.03]")}>
                <div className="flex items-center gap-2">
                  {m.read ? <MailOpen size={14} className="text-muted shrink-0" /> : <Mail size={14} className="text-primary shrink-0" />}
                  <span className={cn("text-sm truncate flex-1", !m.read && "font-semibold")}>{m.fromName || m.from}</span>
                  <span className="text-[11px] text-muted shrink-0">{fmtTime(m.receivedAt)}</span>
                </div>
                <p className={cn("text-sm truncate mt-0.5", !m.read ? "font-medium" : "text-fg/90")}>{m.subject || "(no subject)"}{m.attachments.length > 0 && <Paperclip size={12} className="inline ml-1 text-muted" />}</p>
                <p className="text-xs text-muted truncate">{m.preview}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className={cn("min-w-0", !open && "hidden md:block")}>
          {open ? (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen(null)}><ArrowLeft size={14} /></Button>
                  <h3 className="font-semibold truncate flex-1">{open.subject || "(no subject)"}</h3>
                  {open.html && open.text && <div className="flex text-xs rounded-md border border-border overflow-hidden">{(["html", "text"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={cn("px-2 py-1", view === v ? "bg-primary text-primary-fg" : "text-muted")}>{v.toUpperCase()}</button>)}</div>}
                  <Button variant="ghost" size="sm" onClick={() => void toggleRead(open.id, !open.read)} title={open.read ? "Mark unread" : "Mark read"}>{open.read ? <Mail size={14} /> : <MailOpen size={14} />}</Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => void remove(open.id)} title="Delete"><Trash2 size={14} /></Button>
                </div>
                <p className="text-xs text-muted">From <span className="text-fg">{open.fromName ? `${open.fromName} <${open.from}>` : open.from}</span> · {new Date(open.receivedAt).toLocaleString()}</p>
                {open.attachments.length > 0 && <p className="text-xs text-muted mt-1 flex flex-wrap gap-1">{open.attachments.map((a, i) => <Badge key={i}><Paperclip size={10} className="inline mr-1" />{a.name}{a.size ? ` (${Math.round(a.size / 1024)} KB)` : ""}</Badge>)}<span className="self-center">Attachments are not stored.</span></p>}
              </div>
              <iframe title="Message" sandbox="" srcDoc={srcdoc} className="w-full flex-1 min-h-[24rem] bg-white" />
            </div>
          ) : (
            <div className="h-full grid place-items-center p-8 text-center text-sm text-muted">
              <div><MailOpen size={32} className="mx-auto mb-2 opacity-50" />{unread > 0 ? `${unread} unread message${unread === 1 ? "" : "s"}` : "Select a message to read it"}<br /><span className="text-xs">Inbox refreshes every {Math.round(pollMs / 1000)} seconds.</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small "create inbox" form shared by the dashboard and the public page. */
export function CreateMailboxForm({ domains, allowCustom, onCreated, compact }: { domains: string[]; allowCustom: boolean; onCreated: (m: MailboxInfo) => void; compact?: boolean }) {
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [local, setLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/tempmail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain, local: allowCustom ? local : "" }) });
      const d = (await r.json()) as { mailbox?: MailboxInfo; error?: string };
      if (d.mailbox) { onCreated(d.mailbox); setLocal(""); } else setError(d.error ?? "Could not create the inbox");
    } catch { setError("Could not reach the server"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className={cn("flex flex-wrap items-end gap-2", compact ? "" : "card p-4")}>
      {allowCustom && <div className="flex-1 min-w-40"><label className="label">Inbox name (optional)</label><input className="input" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="random if empty" maxLength={32} /></div>}
      <div className="min-w-40"><label className="label">Domain</label><select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>{domains.map((d) => <option key={d} value={d}>@{d}</option>)}</select></div>
      <Button type="submit" disabled={busy || !domain}>{busy ? "Creating…" : "Create inbox"}</Button>
      {error && <p className="text-xs text-danger basis-full">{error}</p>}
    </form>
  );
}
