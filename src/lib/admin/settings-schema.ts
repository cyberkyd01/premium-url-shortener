import { DEFAULT_SETTINGS } from "@/lib/settings";
import { BUILTIN_PLUGINS } from "@/lib/admin/plugin-catalog";

export type FieldType = "text" | "textarea" | "code" | "switch" | "select" | "number" | "password" | "upload";
export type DynamicOptions = "languages" | "plans" | "themes";
export interface SettingField { key: string; label: string; type?: FieldType; options?: { value: string; label: string }[] | DynamicOptions; hint?: string; placeholder?: string }
export interface SettingSection { title: string; description?: string; fields: SettingField[]; extra?: "social" | "mailTest" | "storageSync" | "clearCache" | "ads" }
export interface SettingTab { key: string; label: string; sections: SettingSection[] }

const sw = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "switch", hint });
const tx = (key: string, label: string, hint?: string, placeholder?: string): SettingField => ({ key, label, type: "text", hint, placeholder });
const nm = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "number", hint });
const ta = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "textarea", hint });
const cd = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "code", hint });
const pw = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "password", hint });
const up = (key: string, label: string, hint?: string): SettingField => ({ key, label, type: "upload", hint });
const sel = (key: string, label: string, options: SettingField["options"], hint?: string): SettingField => ({ key, label, type: "select", options, hint });
const opts = (...v: string[]) => v.map((x) => ({ value: x, label: x }));

export const SETTINGS_TABS: SettingTab[] = [
  { key: "general", label: "General", sections: [
    { title: "Site", fields: [tx("site.name", "Site name"), tx("site.tagline", "Tagline"), ta("site.description", "Description"), tx("site.email", "Support email"), sel("site.defaultLanguage", "Default language", "languages"), tx("site.timezone", "Timezone", "IANA name, e.g. Europe/London"), tx("site.currency", "Display currency"), sw("site.multiCurrency", "Multi-currency display"), tx("site.footerText", "Footer text")] },
    { title: "Branding", fields: [up("site.logo", "Logo"), up("site.logoDark", "Logo (dark mode)"), up("site.favicon", "Favicon"), up("site.ogImage", "Default social share image")] },
    { title: "SEO", fields: [tx("seo.title", "Meta title", "Defaults to site name + tagline"), ta("seo.description", "Meta description"), tx("seo.keywords", "Meta keywords"), sw("seo.localizedUrls", "Localized URLs (/xx/…)"), sw("seo.hreflang", "Output hreflang tags")] },
    { title: "Cookies, analytics & chat", fields: [sw("cookie.consent", "Cookie consent banner"), tx("cookie.text", "Cookie banner text"), cd("analytics.code", "Analytics code", "Pasted into <head> on public pages (GA, Plausible…)"), sel("chat.provider", "Live chat widget", opts("none", "intercom", "tidio", "tawk", "crisp")), tx("chat.id", "Chat widget ID / key")] },
    { title: "Misc", fields: [tx("misc.dateFormat", "Date format"), sw("misc.bookmarklet", "Show bookmarklet"), sw("misc.extension", "Show browser extension links"), sw("misc.notifications", "In-app notifications"), sw("misc.anonymousStats", "Public stats for anonymous links"), sw("misc.mainDomainForBio", "Bio pages on the main domain"), sw("misc.inAppBreakout", "In-app browser breakout globally")] },
  ] },
  { key: "links", label: "Links", sections: [
    { title: "Shortening", fields: [nm("links.aliasLength", "Random alias length"), sel("links.aliasType", "Alias type", opts("random", "numeric", "words")), sw("links.anonymous", "Allow guests to shorten"), sw("links.anonymousHistory", "Guest recent links (cookie)"), sw("links.customAlias", "Custom aliases for guests"), nm("links.premiumAliasLength", "Premium alias length", "Aliases shorter than this need the premium alias feature"), ta("links.reservedAliases", "Reserved aliases", "Comma separated"), sel("links.defaultRedirect", "Default redirect type", opts("direct", "frame", "splash")), nm("links.redirectDelay", "Redirect delay (s)"), nm("links.anonymousExpiryDays", "Guest links expire after (days)", "0 = never"), sw("links.allowSameDomain", "Allow shortening links from this site")] },
    { title: "Approval & filtering", fields: [sw("links.approval", "Manual approval for guest links"), sw("links.approvalUsers", "Manual approval for user links", "Verified users are exempt"), sw("links.filter", "URL filtering"), ta("links.blockedDomains", "Blocked domains", "One per line"), ta("links.blockedWords", "Blocked words", "One per line"), sw("links.phishtank", "PhishTank check"), sw("links.webrisk", "Google Web Risk check"), pw("links.webriskKey", "Google Web Risk API key"), sw("links.botBlock", "Block bots globally")] },
    { title: "Statistics", fields: [nm("links.uniqueClicksWindow", "Unique click window (hours)"), sel("links.trackingMethod", "Tracking method", opts("system", "ga")), tx("links.gaId", "Google Analytics ID (redirect pages)"), sw("links.publicStats", "Public statistics pages"), sw("links.sitemap", "Include links in sitemap")] },
    { title: "Frame & splash", fields: [sw("frame.ads", "Ads in frame bar"), sw("splash.ads", "Ads on splash pages"), nm("splash.countdown", "Splash countdown (s)")] },
    { title: "Domains", fields: [sw("domains.custom", "Allow custom domains"), sw("domains.mainUsable", "Main domain usable by users"), sw("domains.verifyDns", "Verify DNS before activation"), tx("domains.rootRedirect", "Default root redirect for custom domains")] },
  ] },
  { key: "users", label: "Users", sections: [
    { title: "Registration", fields: [sw("users.registration", "Allow registration"), sw("users.emailVerification", "Require email verification"), sw("users.socialOnly", "Social login only"), sel("users.defaultPlan", "Default plan", "plans"), sw("users.trial", "Trial period on signup"), sw("users.verificationSystem", "Verified badge requests"), sw("users.gravatar", "Gravatar avatars"), sw("users.deleteAccount", "Users may delete their account"), sw("users.publicAccounts", "Public account pages"), tx("users.postLoginRedirect", "Post-login redirect")] },
    { title: "Two-factor", fields: [sw("users.twoFactor", "Authenticator app 2FA"), sw("users.emailTwoFactor", "Email OTP 2FA")] },
    { title: "Security", fields: [nm("security.passwordMinLength", "Minimum password length"), nm("security.loginAttempts", "Max login attempts"), nm("security.lockMinutes", "Lockout minutes"), nm("security.sessionDays", "Session lifetime (days)"), ta("security.blockedIps", "Blocked IPs", "One per line"), ta("security.blockedEmails", "Blocked emails / domains", "One per line"), ta("security.blockedCountries", "Blocked countries", "ISO2 codes, one per line; blocks signup and shortening"), sw("security.disposableEmails", "Block disposable emails"), sw("security.contactSpamCheck", "Contact form spam check")] },
    { title: "Social login", description: "Credentials come from environment variables (GOOGLE_CLIENT_ID…). Enable the buttons here.", extra: "social", fields: [sw("social.google", "Google"), sw("social.facebook", "Facebook"), sw("social.twitter", "X / Twitter")] },
  ] },
  { key: "captcha", label: "Captcha", sections: [
    { title: "Provider", fields: [sel("captcha.provider", "Provider", opts("none", "recaptcha", "recaptcha3", "hcaptcha", "turnstile", "solvemedia", "altcha")), tx("captcha.siteKey", "Site key"), pw("captcha.secretKey", "Secret key")] },
    { title: "Show captcha on", fields: [sw("captcha.onShorten", "Shorten form (guests)"), sw("captcha.onRegister", "Registration"), sw("captcha.onLogin", "Login"), sw("captcha.onContact", "Contact form"), sw("captcha.onPassword", "Password reset")] },
  ] },
  { key: "email", label: "Email", sections: [
    { title: "Sender", fields: [sel("mail.provider", "Provider", opts("smtp", "mailgun", "sendgrid", "postmark", "ses", "resend", "mailchimp", "log")), tx("mail.from", "From address"), tx("mail.fromName", "From name")] },
    { title: "SMTP / API", extra: "mailTest", fields: [tx("mail.host", "SMTP host"), nm("mail.port", "SMTP port"), tx("mail.user", "SMTP user"), pw("mail.pass", "SMTP password"), sw("mail.secure", "Force TLS"), pw("mail.apiKey", "API key (Mailgun, SendGrid, Postmark, Resend…)"), tx("mail.region", "AWS SES region")] },
  ] },
  { key: "payments", label: "Payments", sections: [
    { title: "Billing", fields: [sw("payments.enabled", "Payments enabled"), tx("payments.currency", "Currency (ISO)"), sw("payments.taxEnabled", "Apply tax rates"), tx("payments.invoicePrefix", "Invoice prefix"), ta("payments.invoiceFooter", "Invoice footer"), ta("payments.bankDetails", "Bank transfer details")] },
    { title: "Pricing page", fields: [sw("payments.customPlanBanner", "Show custom plan banner"), tx("payments.customPlanText", "Banner text"), tx("payments.customPlanUrl", "Banner link")] },
  ] },
  { key: "bio", label: "Bio pages", sections: [{ title: "Bio pages", fields: [sw("bio.enabled", "Bio pages enabled"), sw("bio.publicProfiles", "Public profile directory"), sw("bio.branding", "Show branding on free pages"), sw("bio.autoCreate", "Create a bio page on signup"), pw("bio.giphyKey", "Giphy API key"), pw("bio.mailchimpKey", "Mailchimp API key"), tx("bio.mailchimpList", "Mailchimp list ID")] }] },
  { key: "qr", label: "QR codes", sections: [{ title: "QR codes", fields: [sw("qr.enabled", "QR codes enabled"), sw("qr.public", "Public QR generator"), up("qr.defaultLogo", "Default logo"), sw("qr.advanced", "Advanced styling")] }] },
  { key: "teams", label: "Teams & API", sections: [{ title: "Teams", fields: [sw("teams.enabled", "Teams enabled")] }, { title: "API", fields: [sw("api.enabled", "Public API enabled"), nm("api.rateLimit", "Rate limit per minute (users)"), nm("api.rateLimitGuest", "Rate limit per minute (guests)", "0 = disabled")] }] },
  { key: "storage", label: "Storage", sections: [{ title: "File storage", extra: "storageSync", fields: [sel("storage.driver", "Driver", opts("local", "s3", "spaces", "r2", "b2", "wasabi", "vultr", "contabo", "custom")), tx("storage.bucket", "Bucket"), tx("storage.region", "Region"), tx("storage.key", "Access key"), pw("storage.secret", "Secret key"), tx("storage.endpoint", "Endpoint URL"), tx("storage.cdnUrl", "CDN / public URL"), nm("storage.maxSizeKb", "Max upload size (KB)"), tx("storage.allowedExtensions", "Allowed extensions", "Comma separated")] }] },
  { key: "cache", label: "Cache", sections: [{ title: "Cache", extra: "clearCache", fields: [sel("cache.driver", "Driver", opts("memory", "file", "redis")), tx("cache.redisUrl", "Redis URL"), nm("cache.ttl", "TTL (seconds)")] }] },
  { key: "ai", label: "AI", sections: [{ title: "AI Copilot", fields: [sw("ai.enabled", "AI features enabled"), sel("ai.provider", "Provider", opts("openai", "gemini", "anthropic")), tx("ai.model", "Model", "Leave blank for the provider default"), nm("ai.monthlyCredits", "Free monthly credits"), nm("ai.rateLimit", "Rate limit per minute"), tx("ai.features", "Enabled features", "Comma separated: slug,bio,insights")] }] },
  { key: "content", label: "Blog & Help", sections: [{ title: "Blog", fields: [sw("blog.enabled", "Blog enabled"), nm("blog.perPage", "Posts per page")] }, { title: "Help center & testimonials", fields: [sw("help.enabled", "Help center enabled"), sw("testimonials.enabled", "Testimonials on homepage")] }] },
  { key: "affiliate", label: "Affiliate", sections: [{ title: "Affiliate program", fields: [sw("affiliate.enabled", "Enabled"), nm("affiliate.commission", "Commission"), sel("affiliate.commissionType", "Commission type", opts("percent", "fixed")), sel("affiliate.frequency", "Frequency", [{ value: "first", label: "First payment" }, { value: "recurring", label: "Every payment" }]), nm("affiliate.minPayout", "Minimum payout"), nm("affiliate.cookieDays", "Cookie days"), sel("affiliate.tagType", "Referral tag", opts("code", "username"))] }] },
  { key: "plugins", label: "Plugins", sections: BUILTIN_PLUGINS.filter((p) => p.settingsFields?.length).map((p) => ({
    title: p.name, description: `${p.description} Enforced while the plugin is active (Plugins page).`,
    fields: (p.settingsFields ?? []).map((f): SettingField => ({ key: f.key, label: f.label, type: f.type ?? "text", hint: f.hint, placeholder: f.placeholder })),
  })) },
  { key: "advanced", label: "Advanced", sections: [
    { title: "Availability", fields: [sw("site.maintenance", "Maintenance mode"), ta("site.maintenanceMessage", "Maintenance message"), sw("site.private", "Private service", "Only logged-in users (or admins) can shorten"), sel("site.privateMode", "Private mode", [{ value: "login", label: "Logged-in users" }, { value: "admin", label: "Admins only" }])] },
    { title: "Appearance", fields: [sel("site.theme", "Active theme", "themes"), sel("site.colorScheme", "Color scheme", opts("light", "dark", "system")), sel("site.homepage", "Homepage variant", opts("default", "landing", "minimal"))] },
    { title: "Custom code", fields: [cd("site.headCode", "Custom <head> code"), cd("site.footerCode", "Custom footer code"), cd("site.customCss", "Custom CSS"), cd("site.customJs", "Custom JavaScript")] },
    { title: "Maintenance & updates", fields: [nm("links.cleanupDays", "Auto-delete links with no clicks after (days)", "0 = disabled; run via the cleanup cron"), sel("misc.updateChannel", "Update channel", opts("stable", "beta"))] },
    { title: "Advertisements (raw)", description: "Prefer the Advertisements page; these are the raw values the frontend reads.", extra: "ads", fields: [sw("ads.enabled", "Ads enabled"), sw("ads.hideForPremium", "Hide for premium"), cd("ads.header", "Header"), cd("ads.footer", "Footer"), cd("ads.sidebar", "Sidebar"), cd("ads.splashTop", "Splash top"), cd("ads.splashBottom", "Splash bottom"), cd("ads.frame", "Frame"), cd("ads.bio", "Bio")] },
    { title: "Integrations (raw)", description: "Managed on the Integrations page.", fields: [sw("slack.enabled", "Slack app"), tx("slack.clientId", "Slack client ID"), pw("slack.clientSecret", "Slack client secret"), pw("slack.signingSecret", "Slack signing secret"), pw("slack.verificationToken", "Slack verification token"), sw("zapier.enabled", "Zapier")] },
  ] },
];

/** Keys in DEFAULT_SETTINGS that no tab covers (rendered as plain text inputs in Advanced → Other). */
export function uncoveredKeys(): string[] {
  const covered = new Set(SETTINGS_TABS.flatMap((t) => t.sections.flatMap((s) => s.fields.map((f) => f.key))));
  return Object.keys(DEFAULT_SETTINGS).filter((k) => !covered.has(k));
}

export function tabWithFallback(tab: SettingTab): SettingTab {
  if (tab.key !== "advanced") return tab;
  const other = uncoveredKeys();
  if (!other.length) return tab;
  return { ...tab, sections: [...tab.sections, { title: "Other", fields: other.map((k) => ({ key: k, label: k, type: "text" as const })) }] };
}

export function fieldsOfTab(key: string): SettingField[] {
  const tab = SETTINGS_TABS.find((t) => t.key === key);
  return tab ? tabWithFallback(tab).sections.flatMap((s) => s.fields) : [];
}
