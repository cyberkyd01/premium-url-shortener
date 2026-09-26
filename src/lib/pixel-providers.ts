import { PIXEL_PROVIDERS, type PixelProvider } from "./pixels";

/** Dashboard metadata for each pixel provider: label, ID field label, validation hint and pattern. */
export const PIXEL_PROVIDER_META: Record<PixelProvider, { label: string; idLabel: string; hint: string; example: string; pattern: RegExp | null }> = {
  facebook: { label: "Facebook / Meta Pixel", idLabel: "Pixel ID", hint: "Numeric ID from Meta Events Manager", example: "123456789012345", pattern: /^\d{6,20}$/ },
  twitter: { label: "X / Twitter Pixel", idLabel: "Pixel ID", hint: "Short alphanumeric ID from X Ads", example: "o1abc", pattern: /^[a-z0-9]{4,12}$/i },
  bing: { label: "Microsoft (Bing) Ads UET", idLabel: "UET Tag ID", hint: "Numeric UET tag ID", example: "12345678", pattern: /^\d{5,20}$/ },
  "google-ads": { label: "Google Ads", idLabel: "Conversion ID", hint: "Conversion ID including the AW- prefix", example: "AW-123456789", pattern: /^AW-\d{6,15}$/ },
  gtm: { label: "Google Tag Manager", idLabel: "Container ID", hint: "Container ID starting with GTM-", example: "GTM-ABC123", pattern: /^GTM-[A-Z0-9]{4,12}$/ },
  ga: { label: "Google Analytics 4", idLabel: "Measurement ID", hint: "GA4 measurement ID starting with G-", example: "G-ABCD123456", pattern: /^(G|UA)-[A-Z0-9-]{4,20}$/ },
  snapchat: { label: "Snapchat Pixel", idLabel: "Pixel ID", hint: "UUID from Snapchat Ads Manager", example: "8e1c1a2e-1234-4b1c-9a4c-1234567890ab", pattern: /^[0-9a-f-]{20,40}$/i },
  reddit: { label: "Reddit Pixel", idLabel: "Pixel ID", hint: "ID starting with t2_", example: "t2_abc123", pattern: /^t2_[a-z0-9]{3,20}$/i },
  quora: { label: "Quora Pixel", idLabel: "Pixel ID", hint: "Hexadecimal ID from Quora Ads", example: "9d3a1f2c4b5e6a7d8c9b0a1f2e3d4c5b", pattern: /^[a-f0-9]{16,40}$/i },
  pinterest: { label: "Pinterest Tag", idLabel: "Tag ID", hint: "Numeric tag ID", example: "2612345678901", pattern: /^\d{6,20}$/ },
  tiktok: { label: "TikTok Pixel", idLabel: "Pixel ID", hint: "Alphanumeric pixel code", example: "C1ABCDEFGHIJKLMNOPQR", pattern: /^[A-Z0-9]{10,30}$/ },
  linkedin: { label: "LinkedIn Insight Tag", idLabel: "Partner ID", hint: "Numeric partner ID", example: "1234567", pattern: /^\d{4,12}$/ },
  adroll: { label: "AdRoll", idLabel: "Advertiser ID | Pixel ID", hint: "Both IDs separated by a pipe: ADVERTISER_ID|PIXEL_ID", example: "ABCDEFGHIJKLMNOPQRSTUV|WXYZABCDEFGHIJKLMNOPQR", pattern: /^[A-Z0-9_]{5,40}\|[A-Z0-9_]{5,40}$/i },
  hotjar: { label: "Hotjar", idLabel: "Site ID", hint: "Numeric site ID", example: "1234567", pattern: /^\d{4,12}$/ },
  clarity: { label: "Microsoft Clarity", idLabel: "Project ID", hint: "Alphanumeric project ID", example: "abcd1234ef", pattern: /^[a-z0-9]{6,20}$/i },
  matomo: { label: "Matomo", idLabel: "Tracker URL | Site ID", hint: "Matomo URL and site ID separated by a pipe", example: "https://matomo.example.com|1", pattern: /^https?:\/\/[^|\s]+\|\d{1,8}$/ },
  custom: { label: "Custom script", idLabel: "Script", hint: "Paste the raw tracking code including <script> tags", example: "<script>...</script>", pattern: null },
};

export const PIXEL_PROVIDER_LIST = PIXEL_PROVIDERS.map((key) => ({ key, ...PIXEL_PROVIDER_META[key] }));

export function isPixelProvider(v: string): v is PixelProvider {
  return (PIXEL_PROVIDERS as readonly string[]).includes(v);
}
export function pixelProviderLabel(key: string) {
  return isPixelProvider(key) ? PIXEL_PROVIDER_META[key].label : key;
}
/** Returns an error message when the ID does not match the provider's format, otherwise null. */
export function validatePixelId(provider: PixelProvider, pixelId: string): string | null {
  const meta = PIXEL_PROVIDER_META[provider];
  const v = pixelId.trim();
  if (!v) return `${meta.idLabel} is required`;
  if (provider === "custom") return v.length > 20000 ? "Script is too long" : null;
  if (meta.pattern && !meta.pattern.test(v)) return `Invalid ${meta.idLabel}. ${meta.hint}, e.g. ${meta.example}`;
  return null;
}
