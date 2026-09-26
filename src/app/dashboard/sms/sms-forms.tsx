"use client";
import { useActionState, useState } from "react";
import { Input, Textarea, Switch, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import { saveTwilioSettings, addContact, importContacts, deleteContact, sendMessages } from "./actions";

export function TwilioForm({ sid, from, hasToken }: { sid: string; from: string; hasToken: boolean }) {
  const [state, action] = useActionState(saveTwilioSettings, null);
  return (
    <form action={action} className="space-y-3">
      <Input label="Account SID" name="sid" defaultValue={sid} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      <Input label="Auth token" name="token" type="password" placeholder={hasToken ? "•••••••• (saved)" : "Your Twilio auth token"} autoComplete="off" />
      <Input label="From number or Messaging Service SID" name="from" defaultValue={from} placeholder="+14155552671" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Save settings</SubmitButton>
    </form>
  );
}

export function ContactsPanel({ contacts }: { contacts: { id: string; name: string | null; phone: string }[] }) {
  const [addState, addAction] = useActionState(addContact, null);
  const [importState, importAction] = useActionState(importContacts, null);
  return (
    <div className="space-y-4">
      <form action={addAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end">
        <Input label="Name" name="name" placeholder="Jane" />
        <Input label="Phone (E.164)" name="phone" required placeholder="+14155552671" />
        <SubmitButton variant="secondary">Add</SubmitButton>
        <div className="sm:col-span-3"><FormMessage state={addState} /></div>
      </form>
      <form action={importAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="flex-1 min-w-48"><label className="label">Import CSV</label><input type="file" name="file" accept=".csv,text/csv" required className="text-sm" /><p className="hint">Columns: name, phone (any order; header optional).</p></div>
        <SubmitButton variant="secondary">Import</SubmitButton>
        <div className="basis-full"><FormMessage state={importState} /></div>
      </form>
      {contacts.length > 0 && (
        <ul className="divide-y divide-border max-h-64 overflow-auto text-sm">
          {contacts.map((c) => <li key={c.id} className="flex items-center justify-between py-1.5"><span>{c.name ? <span className="font-medium">{c.name} </span> : null}<span className="text-muted">{c.phone}</span></span><ConfirmForm action={deleteContact} hidden={{ id: c.id }} message="Delete contact?"><Button type="submit" variant="ghost" size="sm" className="text-danger">Delete</Button></ConfirmForm></li>)}
        </ul>
      )}
    </div>
  );
}

export function SendForm({ contacts, configured, remaining }: { contacts: { id: string; name: string | null; phone: string }[]; configured: boolean; remaining: number }) {
  const [state, action] = useActionState(sendMessages, null);
  const [shorten, setShorten] = useState(true);
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const segments = Math.max(1, Math.ceil(body.length / (/[^\x00-\x7F]/.test(body) ? 70 : 160)));
  return (
    <form action={action} className="space-y-3">
      <Textarea label="Recipients (one per line or comma separated, E.164)" name="to" placeholder={"+14155552671\n+447700900123"} />
      {contacts.length > 0 && (
        <div>
          <div className="flex items-center justify-between"><label className="label">Or pick contacts</label><button type="button" className="text-xs text-primary" onClick={() => setSelected(selected.length === contacts.length ? [] : contacts.map((c) => c.id))}>{selected.length === contacts.length ? "Clear" : "Select all"}</button></div>
          <div className="max-h-40 overflow-auto rounded-lg border border-border p-2 grid sm:grid-cols-2 gap-1 text-sm">
            {contacts.map((c) => <label key={c.id} className="flex items-center gap-2"><input type="checkbox" name="contacts" value={c.id} checked={selected.includes(c.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />{c.name ?? c.phone}{c.name && <span className="text-muted text-xs">{c.phone}</span>}</label>)}
          </div>
        </div>
      )}
      <Textarea label="Message" name="body" required value={body} onChange={(e) => setBody(e.target.value)} maxLength={1600} hint={`${body.length} characters · ~${segments} segment${segments === 1 ? "" : "s"} per recipient`} />
      <Switch label="Automatically shorten URLs in the message" checked={shorten} onChange={setShorten} name="shorten" />
      <FormMessage state={state} />
      {!configured ? <p className="text-sm text-muted">Add your Twilio credentials in the settings panel to send messages.</p> : remaining === 0 ? <p className="text-sm text-muted">You have used all SMS included in your plan this month.</p> : <SubmitButton>Send message{selected.length > 1 ? "s" : ""}</SubmitButton>}
    </form>
  );
}
