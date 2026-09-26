"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui";
import { Captcha, type CaptchaConfig } from "@/components/public/captcha";
import { precheckLogin, requestEmailOtp } from "@/lib/auth-actions";
import { MagicLinkForm } from "./magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  BANNED: "Your account has been suspended. Please contact support.",
  UNVERIFIED: "Please verify your email address before logging in.",
  OTP_INVALID: "The verification code is invalid or expired.",
  OTP_REQUIRED: "Please enter your two-factor verification code.",
  CredentialsSignin: "Invalid login or password.",
};

function describe(err: string | undefined, code: string | undefined) {
  const key = [code, err].find((k) => k && ERROR_MESSAGES[k]);
  if (key) return ERROR_MESSAGES[key];
  const raw = `${code ?? ""} ${err ?? ""}`;
  for (const k of Object.keys(ERROR_MESSAGES)) if (raw.includes(k)) return ERROR_MESSAGES[k];
  return "Login failed. Please check your credentials.";
}

export function LoginForm({ captcha, callbackUrl, invite, initialError, magicLink = false }: { captcha: CaptchaConfig | null; callbackUrl?: string; invite?: string; initialError?: string; magicLink?: boolean }) {
  const router = useRouter();
  const [magic, setMagic] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needOtp, setNeedOtp] = useState<null | "app" | "email">(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState<string | null>(initialError ? describe(initialError, undefined) : null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const onToken = useCallback((t: string) => setCaptchaToken(t), []);
  const target = invite ? `/invite/${encodeURIComponent(invite)}` : callbackUrl;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setInfo(null);
    try {
      let redirectTo = target || "/dashboard";
      if (!needOtp) {
        const pre = await precheckLogin({ login, password, captcha: captchaToken, callbackUrl: target });
        if (!pre.ok) {
          setError(pre.error ?? "Login failed.");
          setUnverified(pre.code === "UNVERIFIED");
          return;
        }
        if (pre.redirectTo) redirectTo = pre.redirectTo;
        if (pre.code === "OTP_REQUIRED") {
          setNeedOtp(pre.twoFactorMethod ?? "app");
          if (pre.twoFactorMethod === "email") {
            const r = await requestEmailOtp(login, password);
            setInfo(r?.message ?? r?.error ?? null);
          }
          return;
        }
      }
      const res = await signIn("credentials", { login, password, otp, redirect: false });
      if (!res || res.error) {
        const msg = describe(res?.error, res?.code);
        if ((res?.code ?? res?.error ?? "").includes("OTP_REQUIRED") || msg === ERROR_MESSAGES.OTP_REQUIRED) setNeedOtp((v) => v ?? "app");
        setError(msg);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    const r = await requestEmailOtp(login, password);
    setInfo(r?.message ?? r?.error ?? null);
  }

  if (magic) return <MagicLinkForm captcha={captcha} onBack={() => setMagic(false)} />;

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert type="error">{error}{unverified && <> <Link href="/resend-verification" className="underline">Resend verification email</Link></>}</Alert>}
      {info && <Alert type="info">{info}</Alert>}
      {!needOtp ? (
        <>
          <div>
            <label className="label" htmlFor="login">Username or email</label>
            <input id="login" className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
          </div>
          <div>
            <div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link href="/forgot" className="text-xs text-primary">Forgot password?</Link></div>
            <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {captcha && <Captcha config={captcha} action="login" onToken={onToken} />}
        </>
      ) : (
        <div>
          <label className="label" htmlFor="otp">Verification code</label>
          <input id="otp" className="input tracking-widest text-center text-lg" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\s/g, ""))} autoComplete="one-time-code" placeholder="123456 or backup code" required autoFocus />
          <p className="hint">{needOtp === "email" ? "Enter the 6-digit code we emailed you." : "Enter the code from your authenticator app."}</p>
          {needOtp === "email" && <button type="button" className="text-xs text-primary mt-1" onClick={resendCode}>Resend code</button>}
        </div>
      )}
      <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>{loading && <Loader2 size={14} className="animate-spin" />}{needOtp ? "Verify & login" : "Login"}</button>
      {needOtp && <button type="button" className="btn-ghost w-full" onClick={() => { setNeedOtp(null); setOtp(""); setError(null); }}>Back</button>}
      {needOtp && <p className="hint text-center">Lost your device? You can enter one of your backup codes instead.</p>}
      {!needOtp && magicLink && <button type="button" className="btn-ghost w-full" onClick={() => { setMagic(true); setError(null); }}>Email me a login link instead</button>}
    </form>
  );
}
