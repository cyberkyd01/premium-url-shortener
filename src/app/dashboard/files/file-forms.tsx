"use client";
import { useActionState, useState } from "react";
import { Input, Select, Switch, Textarea, Modal, Button, CopyButton, Badge } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { ConfirmForm } from "@/components/ui/confirm";
import { UploadField } from "@/components/account/upload-field";
import { uploadHostedFile, updateHostedFile, deleteHostedFileAction } from "./actions";

export type FileRow = { id: string; alias: string; name: string; size: number; mime: string; hasPassword: boolean; expiresAt: string | null; encrypted: boolean; branding: { title?: string; description?: string; logo?: string; color?: string }; downloads: number; createdAt: string; domainId: string | null; url: string };
type DomainOpt = { id: string; domain: string };

function BrandingFields({ b }: { b?: FileRow["branding"] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Download page branding</summary>
      <div className="grid gap-3 sm:grid-cols-2 mt-3">
        <Input label="Title" name="brandTitle" defaultValue={b?.title ?? ""} />
        <Input label="Accent color" name="brandColor" type="color" defaultValue={b?.color || "#6366f1"} />
        <Textarea label="Description" name="brandDescription" defaultValue={b?.description ?? ""} className="sm:col-span-2" />
        <div className="sm:col-span-2"><UploadField name="brandLogo" label="Logo" folder="branding" accept="image/*" value={b?.logo ?? ""} /></div>
      </div>
    </details>
  );
}

export function UploadForm({ domains, localStorage, canUpload }: { domains: DomainOpt[]; localStorage: boolean; canUpload: boolean }) {
  const [state, action] = useActionState(uploadHostedFile, null);
  const [encrypted, setEncrypted] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label">File</label><input type="file" name="file" required className="text-sm" disabled={!canUpload} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Custom alias (optional)" name="alias" placeholder="my-file" hint="Download page: /alias" />
        {domains.length > 0 && <Select label="Domain" name="domainId"><option value="">Default domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</Select>}
        <Input label="Password (optional)" name="password" type="text" autoComplete="off" />
        <Input label="Expires (optional)" name="expiresAt" type="datetime-local" />
      </div>
      <Switch label="Encrypt at rest (AES-256-GCM)" hint={localStorage ? "The file is stored encrypted on the server and decrypted on download." : "Only available with local storage."} checked={encrypted} onChange={setEncrypted} name="encrypted" disabled={!localStorage} />
      <BrandingFields />
      <FormMessage state={state} />
      {canUpload ? <SubmitButton>Upload</SubmitButton> : <p className="text-sm text-muted">Your plan does not include file hosting.</p>}
    </form>
  );
}

export function FilesTable({ files, domains }: { files: FileRow[]; domains: DomainOpt[] }) {
  const [editing, setEditing] = useState<FileRow | null>(null);
  const [state, action] = useActionState(updateHostedFile, null);
  const [removePw, setRemovePw] = useState(false);
  const fmt = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : (n / 1024).toFixed(0) + " KB");
  return (
    <>
      <div className="overflow-x-auto -mx-5 -my-5"><table className="table">
        <thead><tr><th>File</th><th>Link</th><th>Size</th><th>Downloads</th><th>Options</th><th>Expires</th><th></th></tr></thead>
        <tbody>{files.map((f) => (
          <tr key={f.id}>
            <td><p className="font-medium max-w-56 truncate" title={f.name}>{f.name}</p><p className="text-xs text-muted">{f.mime}</p></td>
            <td><div className="flex items-center gap-1"><a href={f.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">{f.url.replace(/^https?:\/\//, "")}</a><CopyButton text={f.url} label="" /></div></td>
            <td>{fmt(f.size)}</td><td>{f.downloads}</td>
            <td className="space-x-1">{f.hasPassword && <Badge color="yellow">Password</Badge>}{f.encrypted && <Badge color="blue">Encrypted</Badge>}</td>
            <td>{f.expiresAt ? (new Date(f.expiresAt) < new Date() ? <Badge color="red">Expired</Badge> : new Date(f.expiresAt).toLocaleDateString()) : "-"}</td>
            <td className="text-right whitespace-nowrap">
              <a href={`/api/files/${f.id}/download`} className="btn-ghost btn-sm">Download</a>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(f); setRemovePw(false); }}>Edit</Button>
              <ConfirmForm action={deleteHostedFileAction} hidden={{ id: f.id }} message="Delete this file? The download link will stop working." className="inline"><Button type="submit" variant="ghost" size="sm" className="text-danger">Delete</Button></ConfirmForm>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit file" wide>
        {editing && (
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={editing.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Display name" name="name" defaultValue={editing.name} />
              <Input label="Alias" name="alias" defaultValue={editing.alias} />
              {domains.length > 0 && <Select label="Domain" name="domainId" defaultValue={editing.domainId ?? ""}><option value="">Default domain</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}</Select>}
              <Input label="Expires" name="expiresAt" type="datetime-local" defaultValue={editing.expiresAt ? editing.expiresAt.slice(0, 16) : ""} />
              <Input label={editing.hasPassword ? "New password (leave empty to keep)" : "Password"} name="password" type="text" autoComplete="off" />
              {editing.hasPassword && <div className="self-end"><Switch label="Remove password" checked={removePw} onChange={setRemovePw} name="removePassword" /></div>}
            </div>
            <BrandingFields b={editing.branding} />
            <FormMessage state={state} />
            <SubmitButton>Save</SubmitButton>
          </form>
        )}
      </Modal>
    </>
  );
}
