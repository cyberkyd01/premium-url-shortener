export type PluginSettingType = "text" | "textarea" | "switch" | "number" | "password";
/** A plugin option stored in the settings table (key is the full `plugin.<slug>.*` key). */
export interface PluginSettingField { key: string; label: string; type?: PluginSettingType; hint?: string; placeholder?: string }
export interface CatalogPlugin {
  slug: string; name: string; description: string; version: string; category: "feature" | "payment" | "security";
  configHref?: string;
  /** Options stored in the plugin's own JSON config column (marketplace plugins). */
  configFields?: { key: string; label: string; secret?: boolean }[];
  /** Built-in add-on: shipped with the app (row auto-created), options stored as `plugin.<slug>.*` settings. */
  builtin?: boolean;
  settingsFields?: PluginSettingField[];
}

const f = (key: string, label: string, type: PluginSettingType = "text", hint?: string, placeholder?: string): PluginSettingField => ({ key, label, type, hint, placeholder });

/** Security / validation add-ons that ship with the app (free). Each slug maps to a `Plugin` row; toggling activates enforcement. */
export const BUILTIN_PLUGINS: CatalogPlugin[] = [
  { slug: "emailvalidation", name: "Email Validation", description: "Validates emails on registration with IPQualityScore: blocks invalid, disposable and high fraud-score addresses.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.emailvalidation.apiKey", "IPQualityScore API key", "password"),
    f("plugin.emailvalidation.minScoreBlock", "Block when fraud score is at least", "number", "0-100. 0 disables the score check."),
    f("plugin.emailvalidation.blockDisposable", "Block disposable emails", "switch"),
    f("plugin.emailvalidation.blockInvalid", "Block invalid / undeliverable emails", "switch"),
  ] },
  { slug: "urlhaus", name: "URLhaus Checker", description: "Rejects links listed as malware distribution sites by abuse.ch URLhaus.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.urlhaus.enabled", "Check URLs against URLhaus", "switch"),
    f("plugin.urlhaus.autoBan", "Auto-ban the domain of listed URLs", "switch", "Adds the host to the blocked domains list."),
    f("plugin.urlhaus.authKey", "URLhaus Auth-Key (optional)", "password", "Get a free key from auth.abuse.ch."),
  ] },
  { slug: "safebrowsing", name: "Google Safe Browsing", description: "Checks every link with the Google Safe Browsing Lookup API (non-commercial use) and rejects flagged URLs.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.safebrowsing.apiKey", "Google Safe Browsing API key", "password", "Create a key in Google Cloud Console with the Safe Browsing API enabled."),
  ] },
  { slug: "whitelist", name: "Whitelist Domains", description: "Only allow shortening links that point to approved domains.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.whitelist.domains", "Allowed domains", "textarea", "One per line. Subdomains are included (example.com matches shop.example.com).", "example.com"),
  ] },
  { slug: "banip", name: "Ban IP Addresses", description: "Prevent specific IP addresses or ranges from registering and shortening links.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.banip.ips", "Banned IPs", "textarea", "One per line. IPv4/IPv6, CIDR (10.0.0.0/8) or prefixes (192.168.).", "203.0.113.0/24"),
  ] },
  { slug: "blockcountries", name: "Block Countries", description: "Block account creation and link shortening from selected countries.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.blockcountries.countries", "Blocked countries", "textarea", "ISO 3166-1 alpha-2 codes, one per line or comma separated.", "RU, KP"),
  ] },
  { slug: "restrictemails", name: "Restrict Emails", description: "Only allow registrations from approved email domains.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.restrictemails.domains", "Allowed email domains", "textarea", "One per line.", "company.com"),
  ] },
  { slug: "blockemails", name: "Block Emails", description: "Deny registrations from specific email domains.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.blockemails.domains", "Blocked email domains", "textarea", "One per line. Full addresses are accepted too.", "spam.example"),
  ] },
  { slug: "noindex", name: "Block Search Engines", description: "Adds noindex robots tags and X-Robots-Tag headers to short links so they are not indexed.", version: "1.0.0", category: "security", builtin: true, settingsFields: [
    f("plugin.noindex.enabled", "Send noindex on short links", "switch"),
  ] },
  { slug: "regwebhook", name: "Registration Webhook", description: "POST a JSON payload to your endpoint whenever a new user registers (HMAC signed).", version: "1.0.0", category: "feature", builtin: true, settingsFields: [
    f("plugin.regwebhook.url", "Webhook URL", "text", undefined, "https://example.com/hooks/registered"),
    f("plugin.regwebhook.secret", "Signing secret (optional)", "password", "X-Signature header = HMAC-SHA256 hex digest of the body."),
  ] },
  { slug: "mailchimp", name: "Mailchimp", description: "Add new users to a Mailchimp audience automatically.", version: "1.0.0", category: "feature", builtin: true, settingsFields: [
    f("plugin.mailchimp.apiKey", "Mailchimp API key", "password"),
    f("plugin.mailchimp.listId", "Audience / list ID", "text"),
    f("plugin.mailchimp.doubleOptIn", "Double opt-in (pending status)", "switch"),
  ] },
  { slug: "noip", name: "No IP", description: "Privacy mode: never store visitor IP addresses in click, bio view and QR scan statistics.", version: "1.0.0", category: "security", builtin: true, settingsFields: [] },
];

/** Static marketplace catalog (mirrors the official plugin list) plus the built-in add-ons. */
export const PLUGIN_CATALOG: CatalogPlugin[] = [
  ...BUILTIN_PLUGINS,
  { slug: "helpdesk", name: "Helpdesk", description: "Support tickets with categories, saved replies, priorities and ratings.", version: "1.0.0", category: "feature", configHref: "/admin/tickets/settings" },
  { slug: "filehosting", name: "File Hosting", description: "Let users upload and share files with short links, passwords and expiry.", version: "1.0.0", category: "feature", configFields: [{ key: "maxSizeMb", label: "Max file size (MB)" }, { key: "allowedTypes", label: "Allowed MIME types (comma separated)" }, { key: "downloadPage", label: "Show download page (1/0)" }] },
  { slug: "sendsms", name: "Send SMS (Twilio)", description: "Send short links via SMS to contacts using Twilio.", version: "1.0.0", category: "feature", configFields: [{ key: "accountSid", label: "Default Twilio Account SID" }, { key: "authToken", label: "Default Twilio Auth Token", secret: true }, { key: "from", label: "Default sender number" }] },
  { slug: "razorpay", name: "Razorpay", description: "Accept payments in India with Razorpay.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=razorpay" },
  { slug: "cryptocom", name: "Crypto.com Pay", description: "Accept crypto payments.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=cryptocom" },
  { slug: "coinpayments", name: "CoinPayments", description: "Accept 100+ cryptocurrencies.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=coinpayments" },
  { slug: "midtrans", name: "Midtrans", description: "Payments for Indonesia.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=midtrans" },
  { slug: "lemonsqueezy", name: "Lemon Squeezy", description: "Merchant of record payments & subscriptions.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=lemonsqueezy" },
  { slug: "iyzico", name: "Iyzico", description: "Payments for Turkey.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=iyzico" },
  { slug: "mollie", name: "Mollie", description: "European payment methods (iDEAL, SEPA, cards).", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=mollie" },
  { slug: "mercadopago", name: "MercadoPago Payments", description: "Checkout Pro and recurring preapproval payments for Latin America.", version: "1.0.0", category: "payment", configHref: "/admin/gateways?g=mercadopago" },
  { slug: "tempmail", name: "Temporary Email", description: "Disposable inboxes for users and guests with inbound webhooks (Mailgun, SendGrid, Postmark, Cloudflare).", version: "1.0.0", category: "feature", configHref: "/admin/temp-mail" },
  { slug: "cloudflare-ssl", name: "Cloudflare SaaS SSL", description: "Automatic HTTPS certificates for user custom domains via Cloudflare for SaaS custom hostnames.", version: "1.0.0", category: "feature", configHref: "/admin/cloudflare" },
  { slug: "bio-directory", name: "Bio Pages Directory", description: "Public /bio-pages directory of opted-in bio pages with search and featured sorting.", version: "1.0.0", category: "feature", configHref: "/bio-pages" },
  { slug: "blog-rss", name: "Blog RSS Feed", description: "RSS 2.0 feed of the latest blog posts at /blog/feed.xml.", version: "1.0.0", category: "feature", configHref: "/blog/feed.xml" },
  { slug: "chrome-extension", name: "Chrome Extension", description: "Browser extension to shorten the current page or any link (source in integrations/chrome-extension).", version: "1.0.0", category: "feature", configHref: "/tools" },
  { slug: "wordpress", name: "WordPress Plugin", description: "Shorten links from WordPress with the bundled plugin (integrations/wordpress).", version: "1.0.0", category: "feature", configHref: "/tools" },
  { slug: "saas-theme", name: "SaaS Theme", description: "Premium SaaS landing theme with 5 color schemes and a custom palette.", version: "1.0.0", category: "feature", configHref: "/admin/themes/saas" },
];
