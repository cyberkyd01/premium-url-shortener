import { getSettings } from "./settings";

/** Verifies a captcha token for the configured provider (reCAPTCHA v2/v3, hCaptcha, Turnstile, SolveMedia, Altcha). */
export async function verifyCaptcha(token: string | null | undefined, ip?: string): Promise<boolean> {
  const s = await getSettings();
  const provider = s["captcha.provider"];
  if (provider === "none") return true;
  if (!token) return false;
  const secret = s["captcha.secretKey"] || process.env.RECAPTCHA_SECRET_KEY || "";
  const endpoints: Record<string, string> = {
    recaptcha: "https://www.google.com/recaptcha/api/siteverify",
    recaptcha3: "https://www.google.com/recaptcha/api/siteverify",
    hcaptcha: "https://hcaptcha.com/siteverify",
    turnstile: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    solvemedia: "http://verify.solvemedia.com/api/verify",
  };
  if (provider === "altcha") {
    try { const p = JSON.parse(Buffer.from(token, "base64").toString()); return !!p.challenge && !!p.signature; } catch { return false; }
  }
  const url = endpoints[provider];
  if (!url) return true;
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: token, remoteip: ip ?? "" }) });
    const data = (await res.json()) as { success?: boolean; score?: number };
    if (provider === "recaptcha3") return !!data.success && (data.score ?? 0) >= 0.5;
    return !!data.success;
  } catch { return false; }
}

export async function captchaClientConfig() {
  const s = await getSettings();
  return { provider: s["captcha.provider"], siteKey: s["captcha.siteKey"] || process.env.RECAPTCHA_SITE_KEY || "", on: { shorten: s["captcha.onShorten"] === "1", register: s["captcha.onRegister"] === "1", login: s["captcha.onLogin"] === "1", contact: s["captcha.onContact"] === "1", password: s["captcha.onPassword"] === "1" } };
}
