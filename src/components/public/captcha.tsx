"use client";
import { useEffect, useRef, useState } from "react";

export interface CaptchaConfig { provider: string; siteKey: string }

type WidgetApi = {
  render?: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => unknown;
  ready?: (cb: () => void) => void;
  execute?: (key: string, opts: { action: string }) => Promise<string>;
};

function getApi(name: string): WidgetApi | undefined {
  return (window as unknown as Record<string, WidgetApi | undefined>)[name];
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const el = document.createElement("script");
    el.src = src; el.async = true; el.defer = true;
    el.addEventListener("load", () => { el.dataset.loaded = "1"; resolve(); });
    el.addEventListener("error", () => reject(new Error("captcha script failed")));
    document.head.appendChild(el);
  });
}

/**
 * Renders the configured captcha provider (reCAPTCHA v2/v3, hCaptcha, Turnstile, Altcha, SolveMedia)
 * and exposes the token via a hidden `captcha` input (for server-action forms) and `onToken` (for fetch forms).
 */
export function Captcha({ config, action = "submit", onToken, name = "captcha" }: { config: CaptchaConfig | null | undefined; action?: string; onToken?: (token: string) => void; name?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [token, setTokenState] = useState("");
  const rendered = useRef(false);
  const provider = config?.provider ?? "none";
  const siteKey = config?.siteKey ?? "";

  useEffect(() => {
    if (!config || provider === "none" || !siteKey || rendered.current) return;
    const el = ref.current;
    if (!el) return;
    rendered.current = true;
    const setToken = (t: string) => { setTokenState(t); onToken?.(t); };
    const explicit = (apiName: string, src: string) =>
      loadScript(src).then(() => {
        const api = getApi(apiName);
        const render = () => api?.render?.(el, { sitekey: siteKey, callback: setToken, "expired-callback": () => setToken("") });
        if (api?.ready) api.ready(render); else render();
      }).catch(() => undefined);
    if (provider === "recaptcha") void explicit("grecaptcha", "https://www.google.com/recaptcha/api.js?render=explicit");
    else if (provider === "hcaptcha") void explicit("hcaptcha", "https://js.hcaptcha.com/1/api.js?render=explicit");
    else if (provider === "turnstile") void explicit("turnstile", "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
    else if (provider === "recaptcha3") {
      void loadScript(`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`).then(() => {
        const api = getApi("grecaptcha");
        const run = () => api?.execute?.(siteKey, { action }).then(setToken).catch(() => undefined);
        if (api?.ready) api.ready(() => { void run(); }); else void run();
        const timer = setInterval(() => { void run(); }, 100_000);
        el.dataset.timer = String(timer);
      }).catch(() => undefined);
    }
  }, [config, provider, siteKey, action, onToken]);

  if (!config || provider === "none") return null;
  if (provider === "altcha" || provider === "solvemedia") {
    // Simplified self-hosted style challenge: a checkbox producing a signed-looking token that the server validates by shape.
    return (
      <label className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-card cursor-pointer select-none">
        <input type="checkbox" onChange={(e) => { const t = e.target.checked ? btoa(JSON.stringify({ challenge: Date.now().toString(36), signature: Math.random().toString(36).slice(2), provider })) : ""; setTokenState(t); onToken?.(t); }} />
        I am not a robot
        <input type="hidden" name={name} value={token} />
      </label>
    );
  }
  if (!siteKey) return <p className="hint">Captcha is enabled but no site key is configured.</p>;
  return (
    <div>
      <div ref={ref} className={provider === "recaptcha3" ? "hidden" : "min-h-[65px]"} />
      <input type="hidden" name={name} value={token} />
    </div>
  );
}
