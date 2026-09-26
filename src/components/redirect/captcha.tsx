"use client";
import Script from "next/script";

/** Renders the configured captcha widget. The provider injects its response field into the enclosing form. */
export function CaptchaWidget({ provider, siteKey }: { provider: string; siteKey: string }) {
  if (!siteKey || provider === "none") return null;
  if (provider === "recaptcha") return <><Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" /><div className="g-recaptcha" data-sitekey={siteKey} /></>;
  if (provider === "recaptcha3") return <><Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="afterInteractive" onLoad={() => { const g = (window as unknown as { grecaptcha?: { ready: (cb: () => void) => void; execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha; g?.ready(() => g.execute(siteKey, { action: "password" }).then((t) => { const el = document.querySelector<HTMLInputElement>("input[name=captcha]"); if (el) el.value = t; })); }} /><input type="hidden" name="captcha" /></>;
  if (provider === "hcaptcha") return <><Script src="https://js.hcaptcha.com/1/api.js" strategy="afterInteractive" /><div className="h-captcha" data-sitekey={siteKey} /></>;
  if (provider === "turnstile") return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" /><div className="cf-turnstile" data-sitekey={siteKey} /></>;
  return null;
}
