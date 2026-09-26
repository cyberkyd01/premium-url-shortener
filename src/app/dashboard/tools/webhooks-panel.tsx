"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Input, Select, Switch, Button, Modal, Badge, CopyButton } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import { createWebhook, updateWebhook, deleteWebhook, toggleWebhook, testWebhook } from "./actions";

const EVENTS = ["link.created", "link.clicked", "link.updated", "link.deleted", "bio.viewed", "qr.scanned"];
export type HookRow = { id: string; name: string; url: string; events: string[]; secret: string | null; provider: string; active: boolean; lastCalledAt: string | null };
/** Mirrors `WEBHOOK_PROVIDERS` from @/lib/webhooks (passed from the server page so this client bundle stays free of server deps). */
export type ProviderOption = { value: string; label: string; urlLabel: string; secretLabel: string | null; instructions: string };

const URL_PLACEHOLDERS: Record<string, string> = {
  zapier: "https://hooks.zapier.com/hooks/catch/...",
  custom: "https://example.com/webhooks/shortener",
  slack: "https://hooks.slack.com/services/T000/B000/XXXX",
  discord: "https://discord.com/api/webhooks/123/abc",
  telegram: "https://api.telegram.org/bot<TOKEN>/sendMessage",
  teams: "https://xxx.webhook.office.com/webhookb2/...",
};

function HookFields({ h, providers }: { h?: HookRow; providers: ProviderOption[] }) {
  const [provider, setProvider] = useState(h?.provider && providers.some((p) => p.value === h.provider) ? h.provider : providers[0]?.value ?? "custom");
  const opt = providers.find((p) => p.value === provider) ?? providers[0];
  const isTelegram = provider === "telegram";
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" name="name" defaultValue={h?.name ?? ""} required placeholder={opt ? `${opt.label}: new link` : "New link"} />
        <Select label="Provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>{providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
        {opt && <p className="text-xs text-muted sm:col-span-2 rounded-lg bg-bg px-3 py-2">{opt.instructions}</p>}
        <Input label={opt?.urlLabel ?? "Endpoint URL"} name="url" type="url" defaultValue={h?.url ?? ""} required placeholder={URL_PLACEHOLDERS[provider] ?? "https://"} className="sm:col-span-2" />
        {opt?.secretLabel && (
          <Input label={opt.secretLabel} name="secret" defaultValue={isTelegram || h?.provider === provider ? h?.secret ?? "" : ""} required={isTelegram} placeholder={isTelegram ? "123456789 or -1001234567890" : "Auto-generated when empty"} hint={isTelegram ? "Send /start to your bot, then read the chat id from https://api.telegram.org/bot<TOKEN>/getUpdates" : "Payloads are signed with HMAC-SHA256 in the X-Signature header"} className="sm:col-span-2" />
        )}
      </div>
      <div><label className="label">Events</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-sm">{EVENTS.map((e) => <label key={e} className="flex items-center gap-2"><input type="checkbox" name="events" value={e} defaultChecked={h ? h.events.includes(e) : e === "link.created"} />{e}</label>)}</div></div>
    </>
  );
}

function TestButton({ id }: { id: string }) {
  const [state, action] = useActionState(testWebhook, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="sm">Test</SubmitButton>
      {state?.message && <span className="text-xs text-success">{state.message}</span>}
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function WebhooksPanel({ hooks, zapier, providers }: { hooks: HookRow[]; zapier: boolean; providers: ProviderOption[] }) {
  const options = providers.filter((p) => zapier || p.value !== "zapier");
  const [createState, createAction] = useActionState(createWebhook, null);
  const [editState, editAction] = useActionState(updateWebhook, null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HookRow | null>(null);
  const [active, setActive] = useState(true);
  return (
    <div className="space-y-4">
      {hooks.length === 0 ? <p className="text-sm text-muted">No webhooks yet. Connect Zapier, Slack, Discord, Telegram, Microsoft Teams or your own endpoint to react to events in real time.</p> : (
        <div className="overflow-x-auto -mx-5"><table className="table">
          <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Last call</th><th></th></tr></thead>
          <tbody>{hooks.map((h) => (
            <tr key={h.id}>
              <td><p className="font-medium">{h.name}</p><p className="text-xs text-muted">{providers.find((p) => p.value === h.provider)?.label ?? h.provider}</p></td>
              <td className="max-w-56 truncate text-xs" title={h.url}>{h.url}</td>
              <td className="text-xs">{h.events.join(", ")}</td>
              <td>{h.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Paused</Badge>}</td>
              <td className="text-xs whitespace-nowrap">{h.lastCalledAt ? new Date(h.lastCalledAt).toLocaleString() : "never"}</td>
              <td className="text-right whitespace-nowrap">
                <TestButton id={h.id} />
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(h); setActive(h.active); }}>Edit</Button>
                <form action={toggleWebhook} className="inline"><input type="hidden" name="id" value={h.id} /><Button type="submit" variant="ghost" size="sm">{h.active ? "Pause" : "Resume"}</Button></form>
                <ConfirmForm action={deleteWebhook} hidden={{ id: h.id }} message="Delete this webhook?" className="inline"><Button type="submit" variant="ghost" size="sm" className="text-danger">Delete</Button></ConfirmForm>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setOpen(true)}>Add webhook</Button>
        <Link href="/dashboard/webhooks" className="btn-secondary"><ScrollText size={14} />Delivery logs</Link>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New webhook" wide>
        <form action={createAction} className="space-y-4">
          <HookFields providers={options} />
          <FormMessage state={createState} />
          <SubmitButton>Create webhook</SubmitButton>
        </form>
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit webhook" wide>
        {editing && (
          <form action={editAction} className="space-y-4">
            <input type="hidden" name="id" value={editing.id} />
            <HookFields h={editing} providers={options} />
            <Switch label="Active" checked={active} onChange={setActive} name="active" />
            {editing.secret && editing.provider !== "telegram" && <div className="flex items-center gap-2 text-xs"><span className="text-muted">Current secret:</span><code className="bg-bg px-2 py-1 rounded">{editing.secret}</code><CopyButton text={editing.secret} label="" /></div>}
            <FormMessage state={editState} />
            <SubmitButton>Save</SubmitButton>
          </form>
        )}
      </Modal>
    </div>
  );
}
