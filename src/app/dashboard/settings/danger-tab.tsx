"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Card, Input, Button, Alert } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { deleteAccount, exportMyData } from "./actions";

export function DangerTab({ canDelete, hasPassword }: { canDelete: boolean; hasPassword: boolean }) {
  const [state, action] = useActionState(deleteAccount, null);
  const [pending, start] = useTransition();
  const [exportError, setExportError] = useState("");
  useEffect(() => { if (state?.ok) void signOut({ callbackUrl: "/" }); }, [state]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Export my data" description="Download a JSON file with your profile, links, bio pages, QR codes, campaigns, domains, payments and files.">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => {
          const r = await exportMyData();
          if (!r?.ok || typeof r.data !== "string") { setExportError(r?.error ?? "Export failed"); return; }
          const blob = new Blob([r.data], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "my-data.json"; a.click(); URL.revokeObjectURL(a.href);
        })}>{pending ? "Preparing…" : "Download JSON"}</Button>
        {exportError && <p className="hint text-danger">{exportError}</p>}
      </Card>
      <Card title="Delete account" description="This permanently deletes your account, links, bio pages, QR codes, files and all related data.">
        {!canDelete ? <Alert type="info">Account deletion is disabled. Please contact support to delete your account.</Alert> : (
          <form action={action} className="space-y-3">
            {hasPassword && <Input label="Your password" name="password" type="password" required />}
            <Input label='Type "DELETE" to confirm' name="confirm" required placeholder="DELETE" />
            <FormMessage state={state} />
            <SubmitButton variant="danger">Delete my account</SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
