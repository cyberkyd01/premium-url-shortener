"use client";
import { useActionState } from "react";
import Link from "next/link";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { resetPassword } from "@/lib/auth-actions";

export function ResetForm({ token, minPasswordLength }: { token: string; minPasswordLength: number }) {
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {state?.ok ? (
        <Link href="/login" className="btn-primary w-full py-2.5">Go to login</Link>
      ) : (
        <>
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" name="password" type="password" className="input" minLength={minPasswordLength} autoComplete="new-password" required />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" className="input" minLength={minPasswordLength} autoComplete="new-password" required />
          </div>
          <SubmitButton className="w-full py-2.5">Update password</SubmitButton>
        </>
      )}
    </form>
  );
}
