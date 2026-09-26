"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui";

/** Consumes an admin "Login as user" token (/login?token=&as=) through the "impersonate" credentials provider. */
export function ImpersonateSignIn({ token, username }: { token: string; username: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function login() {
    setStatus("loading"); setError(null);
    try {
      const res = await signIn("impersonate", { token, username, redirect: false });
      if (!res || res.error) {
        const raw = `${res?.code ?? ""} ${res?.error ?? ""}`;
        setError(raw.includes("IMPERSONATE_EXPIRED") ? "This login token has expired. Start again from the admin panel." : "This login token is invalid or has already been used.");
        setStatus("error");
        return;
      }
      router.replace("/dashboard");
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
      {status === "error" ? (
        <>
          <Alert type="error">{error}</Alert>
          <Link href="/admin/users" className="btn-primary w-full py-2.5">Back to admin</Link>
        </>
      ) : (
        <>
          <p className="text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Logging in as <strong>{username}</strong>…</p>
          <button type="button" className="btn-secondary w-full" onClick={login}>Not redirected? Click here</button>
        </>
      )}
    </div>
  );
}
