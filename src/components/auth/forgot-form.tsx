"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { Captcha, type CaptchaConfig } from "@/components/public/captcha";
import { forgotPassword } from "@/lib/auth-actions";

export function ForgotForm({ captcha }: { captcha: CaptchaConfig | null }) {
  const [state, action] = useActionState(forgotPassword, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {!state?.ok && (
        <>
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" className="input" autoComplete="email" required />
          </div>
          {captcha && <Captcha config={captcha} action="password" />}
          <SubmitButton className="w-full py-2.5">Send reset link</SubmitButton>
        </>
      )}
    </form>
  );
}
