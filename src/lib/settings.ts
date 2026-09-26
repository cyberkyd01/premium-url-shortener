import { db } from "./db";
import { unstable_cache, revalidateTag } from "next/cache";

/** Every admin-configurable setting with its default. */
export const DEFAULT_SETTINGS: Record<string, string> = {
  // General
  "site.name": "Premium URL Shortener",
  "site.tagline": "Shorten, brand, track and share smart links",
  "site.description": "Short links, bio pages, QR codes, retargeting pixels and detailed analytics.",
  "site.logo": "",
  "site.logoDark": "",
  "site.favicon": "",
  "site.email": "support@example.com",
  "site.defaultLanguage": "en",
  "site.timezone": "UTC",
  "site.currency": "USD",
  "site.theme": "default",
  "site.colorScheme": "system", // light | dark | system
  "site.homepage": "default", // default | landing | minimal
  "site.footerText": "",
  "site.ogImage": "",
  "site.customCss": "",
  "site.customJs": "",
  "site.headCode": "",
  "site.footerCode": "",
  "site.maintenance": "0",
  "site.maintenanceMessage": "We are performing scheduled maintenance. Please check back soon.",
  "site.private": "0", // private service: only admin/logged users can shorten
  "site.privateMode": "login", // login | admin
  "site.multiCurrency": "0",
  // Links
  "links.aliasLength": "6",
  "links.aliasType": "random", // random | numeric | words
  "links.anonymous": "1", // allow guests to shorten
  "links.anonymousHistory": "1",
  "links.customAlias": "1",
  "links.premiumAliasLength": "4", // aliases shorter than this reserved for premium
  "links.reservedAliases": "admin,dashboard,api,login,register,user,blog,help,pricing,features,contact,page,u,qr,go,go2,b,bio,s,static,uploads,sitemap,robots",
  "links.defaultRedirect": "direct",
  "links.redirectDelay": "2",
  "links.approval": "0", // manual approval for guests
  "links.approvalUsers": "0", // manual approval for users
  "links.filter": "1", // URL filtering enabled
  "links.blockedDomains": "",
  "links.blockedWords": "",
  "links.phishtank": "0",
  "links.webrisk": "0",
  "links.webriskKey": "",
  "links.allowSameDomain": "0",
  "links.uniqueClicksWindow": "24", // hours
  "links.botBlock": "0",
  "links.trackingMethod": "system", // system | ga
  "links.gaId": "",
  "links.publicStats": "1",
  "links.sitemap": "1",
  "links.anonymousExpiryDays": "0",
  "links.cleanupDays": "0",
  // Frame / splash
  "frame.ads": "0",
  "splash.ads": "0",
  "splash.countdown": "5",
  // Users
  "users.registration": "1",
  "users.emailVerification": "1",
  "users.socialOnly": "0",
  "users.defaultPlan": "",
  "users.trial": "0",
  "users.verificationSystem": "1",
  "users.gravatar": "1",
  "users.deleteAccount": "1",
  "users.twoFactor": "1",
  "users.emailTwoFactor": "1",
  "users.postLoginRedirect": "/dashboard",
  "users.publicAccounts": "1",
  "users.magicLink": "1",
  // Captcha
  "captcha.provider": "none", // none | recaptcha | recaptcha3 | hcaptcha | turnstile | solvemedia | altcha
  "captcha.siteKey": "",
  "captcha.secretKey": "",
  "captcha.onShorten": "0",
  "captcha.onRegister": "0",
  "captcha.onLogin": "0",
  "captcha.onContact": "1",
  "captcha.onPassword": "0",
  // Email
  "mail.provider": "smtp", // smtp | mailgun | sendgrid | postmark | ses | resend | mailchimp | log
  "mail.from": "no-reply@example.com",
  "mail.fromName": "Premium URL Shortener",
  "mail.host": "",
  "mail.port": "587",
  "mail.user": "",
  "mail.pass": "",
  "mail.secure": "0",
  "mail.apiKey": "",
  "mail.region": "",
  // Ads / monetization
  "ads.enabled": "0",
  "ads.header": "",
  "ads.footer": "",
  "ads.sidebar": "",
  "ads.splashTop": "",
  "ads.splashBottom": "",
  "ads.frame": "",
  "ads.bio": "",
  "ads.hideForPremium": "1",
  // Payments
  "payments.enabled": "1",
  "payments.currency": "USD",
  "payments.taxEnabled": "0",
  "payments.invoicePrefix": "INV",
  "payments.invoiceFooter": "",
  "payments.bankDetails": "",
  "payments.customPlanBanner": "1",
  "payments.customPlanText": "Need a custom plan? Contact us for enterprise pricing.",
  "payments.customPlanUrl": "/contact",
  // Affiliates
  "affiliate.enabled": "1",
  "affiliate.commission": "20",
  "affiliate.commissionType": "percent", // percent | fixed
  "affiliate.frequency": "first", // first | recurring
  "affiliate.minPayout": "50",
  "affiliate.cookieDays": "30",
  "affiliate.tagType": "code", // code | username
  // Bio
  "bio.enabled": "1",
  "bio.publicProfiles": "1",
  "bio.branding": "1",
  "bio.autoCreate": "0",
  "bio.giphyKey": "",
  "bio.mailchimpKey": "",
  "bio.mailchimpList": "",
  // QR
  "qr.enabled": "1",
  "qr.public": "1",
  "qr.defaultLogo": "",
  "qr.advanced": "1",
  // Teams
  "teams.enabled": "1",
  // API
  "api.enabled": "1",
  "api.rateLimit": "60", // per minute
  "api.rateLimitGuest": "0",
  // Storage
  "storage.driver": "local", // local | s3 | spaces | r2 | b2 | wasabi | vultr | contabo | custom
  "storage.bucket": "",
  "storage.region": "",
  "storage.key": "",
  "storage.secret": "",
  "storage.endpoint": "",
  "storage.cdnUrl": "",
  "storage.maxSizeKb": "5120",
  "storage.allowedExtensions": "jpg,jpeg,png,gif,webp,svg,mp4,mp3,pdf,csv,ico",
  // Cache
  "cache.driver": "memory", // memory | file | redis
  "cache.redisUrl": "",
  "cache.ttl": "3600",
  // Social login
  "social.google": "0",
  "social.facebook": "0",
  "social.twitter": "0",
  // Integrations
  "slack.enabled": "0",
  "slack.clientId": "",
  "slack.clientSecret": "",
  "slack.signingSecret": "",
  "slack.verificationToken": "",
  "zapier.enabled": "1",
  "chat.provider": "none", // none | intercom | tidio | tawk | crisp
  "chat.id": "",
  "analytics.code": "",
  "cookie.consent": "1",
  "cookie.text": "We use cookies to improve your experience.",
  // AI Copilot
  "ai.enabled": "0",
  "ai.provider": "openai", // openai | gemini | anthropic
  "ai.model": "",
  "ai.monthlyCredits": "50",
  "ai.rateLimit": "10", // per minute
  "ai.features": "slug,bio,insights",
  // SEO
  "seo.title": "",
  "seo.description": "",
  "seo.keywords": "",
  "seo.localizedUrls": "0",
  "seo.hreflang": "1",
  // Security
  "security.passwordMinLength": "8",
  "security.loginAttempts": "5",
  "security.lockMinutes": "15",
  "security.sessionDays": "30",
  "security.blockedIps": "",
  "security.blockedEmails": "",
  "security.disposableEmails": "0",
  "security.contactSpamCheck": "1",
  "security.blockedCountries": "", // ISO2 codes, comma/newline separated (always enforced on signup + shortening)
  // Blog / help
  "blog.enabled": "1",
  "blog.perPage": "10",
  "help.enabled": "1",
  "testimonials.enabled": "1",
  // Domains
  "domains.custom": "1",
  "domains.mainUsable": "1", // whether users may shorten on main domain
  "domains.verifyDns": "0",
  "domains.rootRedirect": "",
  // Misc
  "misc.dateFormat": "MMM d, yyyy",
  "misc.bookmarklet": "1",
  "misc.extension": "1",
  "misc.notifications": "1",
  "misc.anonymousStats": "0",
  "misc.mainDomainForBio": "1",
  "misc.inAppBreakout": "0",
  "misc.updateChannel": "stable",
  // Built-in security / validation add-ons (enforced only while the matching Plugin row is active; see src/lib/security.ts)
  "plugin.emailvalidation.apiKey": "",
  "plugin.emailvalidation.minScoreBlock": "85",
  "plugin.emailvalidation.blockDisposable": "1",
  "plugin.emailvalidation.blockInvalid": "1",
  "plugin.urlhaus.enabled": "1",
  "plugin.urlhaus.autoBan": "0",
  "plugin.urlhaus.authKey": "",
  "plugin.safebrowsing.apiKey": "",
  "plugin.whitelist.domains": "",
  "plugin.banip.ips": "",
  "plugin.blockcountries.countries": "",
  "plugin.restrictemails.domains": "",
  "plugin.blockemails.domains": "",
  "plugin.noindex.enabled": "1",
  "plugin.regwebhook.url": "",
  "plugin.regwebhook.secret": "",
  "plugin.mailchimp.apiKey": "",
  "plugin.mailchimp.listId": "",
  "plugin.mailchimp.doubleOptIn": "0",
};

const loadAll = unstable_cache(
  async () => {
    const rows = await db.setting.findMany();
    const out: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
  ["settings-all"],
  { tags: ["settings"], revalidate: 300 },
);

export async function getSettings() {
  return loadAll();
}
export async function getSetting(key: string) {
  const all = await loadAll();
  return all[key] ?? DEFAULT_SETTINGS[key] ?? "";
}
export async function getBool(key: string) {
  const v = await getSetting(key);
  return v === "1" || v === "true";
}
export async function getInt(key: string, fallback = 0) {
  const v = parseInt(await getSetting(key), 10);
  return isNaN(v) ? fallback : v;
}
export async function setSettings(values: Record<string, string>) {
  const ops = Object.entries(values).map(([key, value]) =>
    db.setting.upsert({
      where: { key },
      create: { key, value, group: key.split(".")[0] },
      update: { value },
    }),
  );
  await db.$transaction(ops);
  revalidateTag("settings");
}
export function revalidateSettings() {
  revalidateTag("settings");
}
