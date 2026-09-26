"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui";

const MESSAGES: Record<string, string> = {
  BANNED: "Your account has been suspended. Please contact support.",
  UNVERIFIED: "Please verify your email address before logging in.",
  MAGIC_EXPIRED: "This login link has expired. Request a new one.",
};

function describe(res: { error?: string | null; code?: string | null } | undefined) {
  const raw = `${res?.code ?? ""} ${res?.error ?? ""}`;
  for (const k of Object.keys(MESSAGES)) if (raw.includes(k)) return MESSAGES[k];
  return "This login link is invalid or has already been used.";
}

/** Consumes a magic-link token on mount via the "magic" credentials provider; offers a manual retry button. */
export function MagicSignIn({ token, callbackUrl = "/dashboard" }: { token: string; callbackUrl?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function login() {
    setStatus("loading"); setError(null);
    try {
      const res = await signIn("magic", { token, redirect: false, callbackUrl });
      if (!res || res.error) { setError(describe(res)); setStatus("error"); return; }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Login failed. Please try again."); setStatus("error");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {status === "error" && error && <Alert type="error">{error}</Alert>}
      {status !== "error" && <p className="text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Signing you in…</p>}
      {status === "error" ? (
        <Link href="/login" className="btn-primary w-full py-2.5">Back to login</Link>
      ) : (
        <button type="button" className="btn-secondary w-full" onClick={login} disabled={status === "loading"}>Not redirected? Click here to log in</button>
      )}
    </div>
  );
}
