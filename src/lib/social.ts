import type { SocialProvider } from "@/components/auth/social-buttons";

/** Social providers that are both enabled in settings and configured via environment variables. */
export function enabledSocialProviders(s: Record<string, string>): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (s["social.google"] === "1" && process.env.GOOGLE_CLIENT_ID) out.push("google");
  if (s["social.facebook"] === "1" && process.env.FACEBOOK_CLIENT_ID) out.push("facebook");
  if (s["social.twitter"] === "1" && process.env.TWITTER_CLIENT_ID) out.push("twitter");
  return out;
}

export function captchaFor(s: Record<string, string>, key: "onShorten" | "onRegister" | "onLogin" | "onContact" | "onPassword") {
  if (s["captcha.provider"] === "none" || s[`captcha.${key}`] !== "1") return null;
  return { provider: s["captcha.provider"], siteKey: s["captcha.siteKey"] || process.env.RECAPTCHA_SITE_KEY || "" };
}

type SP = Record<string, string | string[] | undefined>;
export function firstParam(sp: SP, key: string) {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}
