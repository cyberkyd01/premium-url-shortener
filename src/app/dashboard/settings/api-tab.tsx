"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Card, Input, Badge, Alert, Button, CopyButton, Modal, Switch } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import { API_PERMISSIONS } from "@/components/account/api-permissions";
import { regenerateApiKey, createApiKey, updateApiKey, deleteApiKey, toggleApiKey } from "./actions";

type Key = { id: string; name: string; key: string; permissions: string; active: boolean; requests: number; lastUsedAt: string | null; expiresAt: string | null; createdAt: string };

function PermissionBoxes({ selected, isAdmin }: { selected: string[]; isAdmin: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-1 text-sm">
      {API_PERMISSIONS.filter((p) => !p.adminOnly || isAdmin).map((p) => (
        <label key={p.key} className="flex items-center gap-2"><input type="checkbox" name="permissions" value={p.key} defaultChecked={selected.includes("*") || selected.includes(p.key)} />{p.label}</label>
      ))}
    </div>
  );
}

export function ApiTab({ apiKey, keys, limit, hasApi, isAdmin, apiEnabled }: { apiKey: string | null; keys: Key[]; limit: number; hasApi: boolean; isAdmin: boolean; apiEnabled: boolean }) {
  const [createState, createAction] = useActionState(createApiKey, null);
  const [editState, editAction] = useActionState(updateApiKey, null);
  const [editing, setEditing] = useState<Key | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [showLegacy, setShowLegacy] = useState(false);
  const canAdd = hasApi && (limit === -1 || keys.length < limit);
  const parse = (s: string): string[] => { try { return JSON.parse(s) as string[]; } catch { return []; } };
  return (
    <div className="space-y-6">
      {!apiEnabled && <Alert type="warning">The API is currently disabled by the administrator.</Alert>}
      {!hasApi && <Alert type="warning">Your plan does not include API access. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to use the API.</Alert>}
      <Card title="Personal API key" description="Legacy single key with full access to your account." actions={<Link href="/developers" className="btn-secondary btn-sm">API documentation</Link>}>
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-bg px-3 py-2 rounded-lg text-sm flex-1 min-w-48">{apiKey ? (showLegacy ? apiKey : apiKey.slice(0, 8) + "••••••••••••••••") : "No key yet"}</code>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowLegacy((v) => !v)}>{showLegacy ? "Hide" : "Show"}</Button>
          {apiKey && <CopyButton text={apiKey} />}
          <ConfirmForm action={async () => { await regenerateApiKey(); }} message="Regenerate your API key? Existing integrations using the old key will stop working."><SubmitButton variant="secondary" size="sm">Regenerate</SubmitButton></ConfirmForm>
        </div>
      </Card>

      <Card title="API keys" description={`Scoped keys for integrations. ${limit === -1 ? "Unlimited" : `${keys.length}/${limit} used`}.`}>
        {keys.length === 0 ? <p className="text-sm text-muted mb-4">No scoped API keys yet.</p> : (
          <div className="overflow-x-auto -mx-5 mb-4"><table className="table">
            <thead><tr><th>Name</th><th>Key</th><th>Permissions</th><th>Requests</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>{keys.map((k) => {
              const perms = parse(k.permissions);
              const expired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false;
              return (
                <tr key={k.id}>
                  <td className="font-medium">{k.name}</td>
                  <td><div className="flex items-center gap-1"><code className="text-xs">{k.key.slice(0, 10)}…</code><CopyButton text={k.key} label="" /></div></td>
                  <td className="text-xs text-muted max-w-56 truncate" title={perms.join(", ")}>{perms.includes("*") ? "All" : perms.join(", ")}</td>
                  <td>{k.requests}{k.lastUsedAt && <span className="block text-xs text-muted">last {new Date(k.lastUsedAt).toLocaleDateString()}</span>}</td>
                  <td>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td>{expired ? <Badge color="red">Expired</Badge> : k.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Disabled</Badge>}</td>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-1 justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(k); setEditActive(k.active); }}>Edit</Button>
                      <form action={toggleApiKey}><input type="hidden" name="id" value={k.id} /><Button type="submit" variant="ghost" size="sm">{k.active ? "Disable" : "Enable"}</Button></form>
                      <ConfirmForm action={deleteApiKey} hidden={{ id: k.id }} message="Delete this API key?"><Button type="submit" variant="ghost" size="sm" className="text-danger">Delete</Button></ConfirmForm>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        {canAdd ? (
          <form action={createAction} className="space-y-3 border-t border-border pt-4">
            <h4 className="font-medium text-sm">Create a new key</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" name="name" required placeholder="Zapier integration" />
              <Input label="Expires (optional)" name="expiresAt" type="date" />
            </div>
            <div><label className="label">Permissions</label><PermissionBoxes selected={API_PERMISSIONS.filter((p) => !p.adminOnly).map((p) => p.key)} isAdmin={isAdmin} /></div>
            <FormMessage state={createState} />
            <SubmitButton>Create key</SubmitButton>
          </form>
        ) : hasApi ? <Alert type="info">You reached the maximum number of API keys for your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> for more.</Alert> : null}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit API key">
        {editing && (
          <form action={editAction} className="space-y-3" onSubmit={() => setTimeout(() => setEditing(null), 300)}>
            <input type="hidden" name="id" value={editing.id} />
            <Input label="Name" name="name" defaultValue={editing.name} required />
            <Input label="Expires" name="expiresAt" type="date" defaultValue={editing.expiresAt ? editing.expiresAt.slice(0, 10) : ""} />
            <div><label className="label">Permissions</label><PermissionBoxes selected={parse(editing.permissions)} isAdmin={isAdmin} /></div>
            <Switch label="Active" checked={editActive} onChange={setEditActive} name="active" />
            <FormMessage state={editState} />
            <SubmitButton>Save</SubmitButton>
          </form>
        )}
      </Modal>
    </div>
  );
}
