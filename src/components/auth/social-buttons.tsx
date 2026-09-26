"use client";
import { signIn } from "next-auth/react";

export type SocialProvider = "google" | "facebook" | "twitter";
const LABELS: Record<SocialProvider, string> = { google: "Google", facebook: "Facebook", twitter: "X / Twitter" };

export function SocialButtons({ providers, callbackUrl, label = "or continue with" }: { providers: SocialProvider[]; callbackUrl?: string; label?: string }) {
  if (!providers.length) return null;
  return (
    <div className="mt-6">
      <div className="relative text-center text-xs text-muted mb-4"><span className="bg-card px-2 relative z-10">{label}</span><span className="absolute inset-x-0 top-1/2 border-t border-border" /></div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
        {providers.map((p) => (
          <button key={p} type="button" className="btn-secondary" onClick={() => signIn(p, { callbackUrl: callbackUrl || "/dashboard" })}>{LABELS[p]}</button>
        ))}
      </div>
    </div>
  );
}
