"use client";
import { useActionState, useState } from "react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { Paperclip, X } from "lucide-react";
import type { AdminAction } from "./action-button";

export function TicketReplyForm({ action, ticketId, savedReplies, statuses }: { action: AdminAction; ticketId: string; savedReplies: { id: string; title: string; content: string }[]; statuses: string[] }) {
  const [state, formAction] = useActionState(action, null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", "tickets");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { url?: string; message?: string };
      if (d.url) setFiles((f) => [...f, d.url!]); else alert(d.message || "Upload failed");
    } finally { setBusy(false); }
  }
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={ticketId} />
      {files.map((f) => <input key={f} type="hidden" name="attachments" value={f} />)}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input w-auto" defaultValue="" onChange={(e) => { const r = savedReplies.find((x) => x.id === e.target.value); if (r) setMessage((m) => (m ? m + "\n\n" : "") + r.content); e.target.value = ""; }}>
          <option value="">Insert saved reply…</option>{savedReplies.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <select name="status" className="input w-auto" defaultValue="pending">{statuses.map((s) => <option key={s} value={s}>Set status: {s}</option>)}</select>
        <label className="btn-secondary btn-sm cursor-pointer"><Paperclip size={14} />{busy ? "Uploading…" : "Attach"}<input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} /></label>
      </div>
      {files.length > 0 && <ul className="flex flex-wrap gap-2 text-xs">{files.map((f) => <li key={f} className="badge-gray flex items-center gap-1"><a href={f} target="_blank" className="underline">{f.split("/").pop()}</a><button type="button" onClick={() => setFiles((x) => x.filter((y) => y !== f))}><X size={12} /></button></li>)}</ul>}
      <textarea name="message" value={message} onChange={(e) => setMessage(e.target.value)} className="input min-h-32" placeholder="Write your reply…" required />
      <FormMessage state={state} />
      <SubmitButton>Send reply</SubmitButton>
    </form>
  );
}
