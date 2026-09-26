"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { SubmitButton, FormMessage, type ActionState } from "@/components/ui/form-state";
import { Alert } from "@/components/ui";
import { Captcha, type CaptchaConfig } from "@/components/public/captcha";
import { registerUser } from "@/lib/auth-actions";

interface RegisterResult { verify: boolean; redirectTo: string }

function resultOf(state: ActionState): RegisterResult | null {
  const d = state?.data;
  if (!state?.ok || !d || typeof d !== "object") return null;
  const r = d as Partial<RegisterResult>;
  return typeof r.verify === "boolean" && typeof r.redirectTo === "string" ? { verify: r.verify, redirectTo: r.redirectTo } : null;
}

export function RegisterForm({ captcha, invite, refCode, minPasswordLength, termsHref }: { captcha: CaptchaConfig | null; invite?: string; refCode?: string; minPasswordLength: number; termsHref?: string }) {
  const router = useRouter();
  const [state, action] = useActionState(registerUser, null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const result = resultOf(state);

  useEffect(() => {
    if (!result || result.verify || signingIn) return;
    setSigningIn(true);
    signIn("credentials", { login: email, password, redirect: false }).then((res) => {
      if (res && !res.error) { router.push(result.redirectTo); router.refresh(); }
      else router.push("/login" + (invite ? `?invite=${encodeURIComponent(invite)}` : ""));
    });
  }, [result, email, password, router, invite, signingIn]);

  if (result?.verify) {
    return (
      <div className="space-y-4">
        <Alert type="success">{state?.message}</Alert>
        <p className="text-sm text-muted">Did not receive the email? <Link href="/resend-verification" className="text-primary">Resend verification</Link>.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      {invite && <input type="hidden" name="invite" value={invite} />}
      {refCode && <input type="hidden" name="ref" value={refCode} />}
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" name="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" pattern="[a-zA-Z0-9_]{3,30}" title="3-30 letters, numbers or underscores" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={minPasswordLength} required />
        <p className="hint">At least {minPasswordLength} characters.</p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" value="1" className="mt-1" required />
        <span>I agree to the <a href={termsHref ?? "/terms"} className="text-primary" target="_blank" rel="noreferrer">terms of service</a> and privacy policy.</span>
      </label>
      {captcha && <Captcha config={captcha} action="register" />}
      <SubmitButton className="w-full py-2.5">{signingIn ? "Signing you in..." : "Create account"}</SubmitButton>
    </form>
  );
}
