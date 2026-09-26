"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { resendVerification } from "@/lib/auth-actions";

export function ResendForm() {
  const [state, action] = useActionState(resendVerification, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {!state?.ok && (
        <>
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <SubmitButton className="w-full py-2.5">Resend verification email</SubmitButton>
        </>
      )}
    </form>
  );
}
