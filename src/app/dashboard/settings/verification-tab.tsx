"use client";
import { useActionState } from "react";
import { BadgeCheck } from "lucide-react";
import { Card, Textarea, Badge, Alert } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { submitVerification } from "./actions";

export function VerificationTab({ verified, requests }: { verified: boolean; requests: { id: string; status: string; message: string | null; createdAt: string }[] }) {
  const [state, action] = useActionState(submitVerification, null);
  const pending = requests.find((r) => r.status === "pending");
  const color = (s: string) => (s === "approved" ? "green" : s === "rejected" ? "red" : "yellow");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Verified badge" description="Verified accounts show a badge on bio pages and public profiles.">
        {verified ? (
          <div className="flex items-center gap-3 text-success"><BadgeCheck size={28} /><div><p className="font-medium">Your account is verified</p><p className="text-sm text-muted">The badge is displayed next to your name.</p></div></div>
        ) : pending ? (
          <Alert type="info">Your verification request is pending review. We will notify you once it is processed.</Alert>
        ) : (
          <form action={action} className="space-y-3">
            <Textarea label="Why should your account be verified?" name="message" required minLength={10} placeholder="Tell us about your brand, audience, or organization and link to your official website or social profiles." />
            <div><label className="label">Supporting document (optional)</label><input type="file" name="document" className="text-sm" accept=".jpg,.jpeg,.png,.pdf,.webp" /><p className="hint">ID, business registration or proof of ownership. Max size set by the administrator.</p></div>
            <FormMessage state={state} />
            <SubmitButton>Submit request</SubmitButton>
          </form>
        )}
      </Card>
      <Card title="Request history">
        {requests.length === 0 ? <p className="text-sm text-muted">No verification requests yet.</p> : (
          <ul className="divide-y divide-border">{requests.map((r) => <li key={r.id} className="py-2 flex items-start justify-between gap-3 text-sm"><div><p className="text-muted text-xs">{new Date(r.createdAt).toLocaleString()}</p><p className="line-clamp-2">{r.message}</p></div><Badge color={color(r.status)}>{r.status}</Badge></li>)}</ul>
        )}
      </Card>
    </div>
  );
}
