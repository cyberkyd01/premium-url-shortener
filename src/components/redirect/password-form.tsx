"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { CaptchaWidget } from "./captcha";

export function PasswordForm({ action, id, title, hint, captcha }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; id: string; title?: string | null; hint?: string;
  captcha: { provider: string; siteKey: string } | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <div className="card max-w-md w-full p-8">
      <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center mb-4"><Lock size={22} /></div>
      <h1 className="text-xl font-bold text-center">{title || "This link is password protected"}</h1>
      <p className="text-sm text-muted text-center mt-1">{hint ?? "Enter the password to continue to the destination."}</p>
      <form action={formAction} className="mt-6 space-y-3">
        <input type="hidden" name="id" value={id} />
        <input type="password" name="password" className="input" placeholder="Password" required autoFocus />
        {captcha && <CaptchaWidget provider={captcha.provider} siteKey={captcha.siteKey} />}
        <FormMessage state={state} />
        <SubmitButton className="w-full">Continue</SubmitButton>
      </form>
    </div>
  );
}
