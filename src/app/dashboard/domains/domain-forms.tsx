"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Input, Button, Alert } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { addDomain, updateDomain, refreshSslAction } from "./actions";
import { Plus, Pencil, RefreshCw, CheckCircle2, ShieldCheck } from "lucide-react";

export function AddDomainButton({ disabled, disabledHint, dnsHint }: { disabled?: boolean; disabledHint?: string; dnsHint: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addDomain, null);
  useEffect(() => { if (state?.ok) { const t = setTimeout(() => setOpen(false), 1200); return () => clearTimeout(t); } }, [state]);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? disabledHint : undefined}><Plus size={16} />Add domain</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add custom domain">
        <form action={action} className="space-y-4">
          <Input label="Domain" name="domain" required placeholder="links.example.com" hint="Enter the hostname only, without http:// or a path." />
          <Alert type="info">{dnsHint}</Alert>
          <Input label="Root redirect (optional)" name="rootRedirect" type="url" placeholder="https://example.com" hint="Where visitors of the bare domain are sent." />
          <Input label="404 redirect (optional)" name="notFoundRedirect" type="url" placeholder="https://example.com/not-found" hint="Fallback URL for unknown aliases on this domain." />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>Add domain</SubmitButton></div>
        </form>
      </Modal>
    </>
  );
}

export function EditDomainButton({ domain }: { domain: { id: string; domain: string; rootRedirect: string | null; notFoundRedirect: string | null } }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateDomain, null);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} title="Edit"><Pencil size={14} /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${domain.domain}`}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={domain.id} />
          <Input label="Root redirect" name="rootRedirect" type="url" defaultValue={domain.rootRedirect ?? ""} placeholder="https://example.com" hint="Where visitors of the bare domain are sent. Leave empty to show the default page." />
          <Input label="404 redirect" name="notFoundRedirect" type="url" defaultValue={domain.notFoundRedirect ?? ""} placeholder="https://example.com/not-found" hint="Fallback URL when an alias does not exist on this domain." />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><SubmitButton>Save</SubmitButton></div>
        </form>
      </Modal>
    </>
  );
}

export function VerifyDomainButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const verify = async () => {
    setBusy(true); setResult(null);
    try {
      const res = await fetch(`/api/domains/verify?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setResult({ ok: !!data.ok, message: data.message ?? data.error ?? (data.ok ? "Verified" : "Verification failed") });
      if (data.ok) router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server" });
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={verify} disabled={busy}>{busy ? <RefreshCw size={14} className="animate-spin" /> : result?.ok ? <CheckCircle2 size={14} className="text-success" /> : <RefreshCw size={14} />}Verify</Button>
      {result && <p className={`text-xs max-w-56 text-right ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>}
    </div>
  );
}

/** Cloudflare SaaS SSL: re-checks the custom hostname / certificate status. */
export function RefreshSslButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(refreshSslAction, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} title="Refresh SSL status">{pending ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}SSL</Button>
      {state?.error && <p className="text-xs text-danger max-w-56 text-right">{state.error}</p>}
      {state?.ok && state.message && <p className="text-xs text-success max-w-56 text-right">{state.message}</p>}
    </form>
  );
}
