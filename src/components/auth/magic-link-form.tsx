"use client";
import { useActionState } from "react";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { Captcha, type CaptchaConfig } from "@/components/public/captcha";
import { requestMagicLink } from "@/lib/auth-actions";

/** "Email me a login link" form: posts to `requestMagicLink`, which always reports success. */
export function MagicLinkForm({ captcha, onBack }: { captcha: CaptchaConfig | null; onBack?: () => void }) {
  const [state, action] = useActionState(requestMagicLink, null);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {!state?.ok && (
        <>
          <div>
            <label className="label" htmlFor="magic-email">Email address</label>
            <input id="magic-email" name="email" type="email" className="input" autoComplete="email" required autoFocus />
            <p className="hint">We will email you a one-time link that logs you in without a password. It expires in 15 minutes.</p>
          </div>
          {captcha && <Captcha config={captcha} action="login" />}
          <SubmitButton className="w-full py-2.5">Email me a login link</SubmitButton>
        </>
      )}
      {onBack && <button type="button" className="btn-ghost w-full" onClick={onBack}>Back to password login</button>}
    </form>
  );
}
