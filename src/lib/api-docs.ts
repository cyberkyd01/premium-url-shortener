/**
 * Typed catalog of the public developer API. Rendered by /developers (HTML) and docs/API.md (Markdown).
 * Keep this file dependency-free so it can be imported from scripts.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiParam { name: string; type: string; required?: boolean; description: string }
export interface ApiExample { body?: unknown; query?: Record<string, string>; response: unknown; curl?: string }
export interface ApiEndpoint {
  method: HttpMethod; path: string; title: string; description?: string; permission?: string; admin?: boolean; auth?: "key" | "session-or-anonymous" | "public" | "cron";
  query?: ApiParam[]; params?: ApiParam[]; example: ApiExample;
}
export interface ApiSection { id: string; title: string; description?: string; endpoints: ApiEndpoint[] }

const LINK_OBJECT = {
  id: "clx1abc", alias: "sale", short: "https://sho.rt/sale", url: "https://example.com/spring-sale", title: "Spring sale", description: null, domain: null, domainId: null,
  clicks: 128, uniqueClicks: 97, redirectType: "direct", password: false, expiresAt: null, clickLimit: null, campaignId: null, channelId: null, pixels: [],
  geoTargets: [{ country: "DE", url: "https://example.de/sale" }], deviceTargets: [], langTargets: [], timeTargets: [], conditions: [], abUrls: [], rotatorMode: "none",
  utm: { source: "newsletter", medium: "email", campaign: "spring" }, customParams: {}, forwardParams: false, deepLink: false, cloaking: false, botBlock: false, inAppBreakout: false,
  isPublic: true, isArchived: false, isPinned: false, status: "active", notes: null, createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z",
};
const PAGINATION = { page: 1, limit: 25, total: 1, pages: 1 };
const STATS_OBJECT = {
  total: 128, unique: 97, byDay: [{ date: "2026-03-01", clicks: 12 }], byHour: [{ hour: 0, clicks: 3 }], countries: [{ label: "US", count: 60 }], cities: [{ label: "New York", count: 20 }],
  regions: [], referers: [{ label: "twitter.com", count: 40 }], browsers: [{ label: "Chrome", count: 90 }], os: [{ label: "iOS", count: 50 }], devices: [{ label: "mobile", count: 80 }],
  languages: [{ label: "en", count: 100 }], targets: [], utmSources: [], utmMediums: [], utmCampaigns: [], heatmap: [[40.71, -74.0]],
};
const LINK_PARAMS: ApiParam[] = [
  { name: "url", type: "string", required: true, description: "Destination URL (http, https, mailto, tel, sms)." },
  { name: "custom", type: "string", description: "Custom alias (letters, numbers, - and _). Alias `alias` is accepted too. Short aliases may require a premium plan." },
  { name: "domain", type: "string", description: "Domain id or hostname of one of your custom domains (or a public domain). Omit for the main domain." },
  { name: "type", type: "string", description: "Redirection type: direct | frame | splash | custom | overlay." },
  { name: "splash", type: "string", description: "Custom splash page id (sets type=custom). See GET /splash." },
  { name: "overlay", type: "string", description: "Overlay id (sets type=overlay). See GET /overlays." },
  { name: "password", type: "string", description: "Password protect the link." },
  { name: "expiry", type: "string", description: "Expiration date (ISO 8601 or unix timestamp). `expiredUrl` may point visitors elsewhere after expiry." },
  { name: "clickLimit", type: "number", description: "Maximum number of clicks (`clickLimitUrl` optional)." },
  { name: "geotarget", type: "array|object", description: "`[{country:'US', state?:'CA', url}]` or legacy `{US:'https://…'}`." },
  { name: "devicetarget", type: "array|object", description: "`[{device:'iphone'|'android'|'ipad'|'mobile'|'desktop'|'windows'|'mac'|'linux', url}]` or `{iphone:'https://…'}`." },
  { name: "languagetarget", type: "array|object", description: "`[{lang:'de', url}]` or `{de:'https://…'}`." },
  { name: "timetarget", type: "array", description: "`[{from:'09:00', to:'17:00', days:[1,2,3,4,5], timezone:'Europe/Berlin', url}]`." },
  { name: "conditions", type: "array", description: "Advanced rules: `[{match:'all'|'any', rules:[{field, op, value}], url}]` (fields: country, region, city, device, os, browser, language, referer, ip, hour, day, inapp, bot, param:<name>)." },
  { name: "abUrls", type: "array", description: "A/B variants `[{url, weight?}]`; `rotatorMode`: ab | rotate | random." },
  { name: "deeplink", type: "object|boolean", description: "`{ios:'app://…', android:'intent://…', fallback:'https://…', auto:true}` or `true` to auto-detect." },
  { name: "utm", type: "object", description: "`{source, medium, campaign, term, content}` appended to the destination." },
  { name: "params", type: "object", description: "Extra query parameters appended to the destination. `forwardParams:true` forwards the visitor's own query string." },
  { name: "campaign", type: "string", description: "Campaign id or slug." },
  { name: "channel", type: "string", description: "Channel id." },
  { name: "pixels", type: "string[]", description: "Retargeting pixel ids." },
  { name: "title / description / image", type: "string", description: "Custom meta tags used for social previews." },
  { name: "cloaking / botBlock / inAppBreakout", type: "boolean", description: "Link cloaking, block bots, break out of in-app browsers." },
  { name: "notes", type: "string", description: "Private notes." },
  { name: "isPublic", type: "boolean", description: "Show public stats for this link (default true)." },
];

export const API_SECTIONS: ApiSection[] = [
  {
    id: "account", title: "Account",
    endpoints: [
      { method: "GET", path: "/api/v1/account", title: "Get account", permission: "account.read", description: "Profile, plan, subscription, limits with current usage and feature flags.",
        example: { response: { error: 0, data: { id: "clx0", username: "jane", email: "jane@example.com", name: "Jane", role: "user", plan: { id: "clxp", name: "Pro", slug: "pro", isFree: false, expires: "2027-01-01T00:00:00.000Z" }, limits: { links: { limit: -1, used: 240 }, bioPages: { limit: 5, used: 1 } }, features: { customAlias: true, api: true } } } } },
      { method: "PUT", path: "/api/v1/account", title: "Update account", permission: "account.write", params: [{ name: "name", type: "string", description: "Display name." }, { name: "avatar", type: "string", description: "Avatar URL." }, { name: "timezone", type: "string", description: "IANA timezone, e.g. Europe/Paris." }, { name: "language", type: "string", description: "Language code." }],
        example: { body: { name: "Jane Doe", timezone: "Europe/Paris" }, response: { error: 0, data: { id: "clx0", username: "jane", name: "Jane Doe", timezone: "Europe/Paris" } } } },
    ],
  },
  {
    id: "links", title: "Links", description: "Create, list, update and analyze short links. Legacy paths `/api/v1/urls`, `POST /api/v1/url`, `/api/v1/stats/:id` and `/api/v1/urls/:id/stats` map to the same handlers.",
    endpoints: [
      { method: "GET", path: "/api/v1/links", title: "List links", permission: "links.read",
        query: [{ name: "search", type: "string", description: "Match alias, url or title." }, { name: "order", type: "string", description: "date (default) | clicks | alias." }, { name: "campaign", type: "string", description: "Campaign id." }, { name: "channel", type: "string", description: "Channel id." }, { name: "domain", type: "string", description: "Domain id/hostname or `main`." }, { name: "status", type: "string", description: "active | pending | disabled | blocked | archived." }, { name: "page / limit", type: "number", description: "Pagination (limit max 100)." }],
        example: { query: { order: "clicks", limit: "25" }, response: { error: 0, data: [LINK_OBJECT], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/links", title: "Create link", permission: "links.write", params: LINK_PARAMS,
        example: { body: { url: "https://example.com/spring-sale", custom: "sale", type: "direct", geotarget: [{ country: "DE", url: "https://example.de/sale" }], utm: { source: "newsletter", medium: "email", campaign: "spring" } }, response: { error: 0, data: LINK_OBJECT, id: "clx1abc", alias: "sale", short: "https://sho.rt/sale", url: "https://example.com/spring-sale" } } },
      { method: "GET", path: "/api/v1/links/:id", title: "Get link", permission: "links.read", description: "`:id` accepts the link id or its alias.", example: { response: { error: 0, data: LINK_OBJECT } } },
      { method: "PUT", path: "/api/v1/links/:id", title: "Update link", permission: "links.write", description: "Accepts every field of *Create link* (all optional) plus `archived`, `pinned` and, for admins, `status`.",
        example: { body: { url: "https://example.com/new-destination", password: "secret", expiry: "2026-12-31T23:59:59Z" }, response: { error: 0, data: { ...LINK_OBJECT, password: true, expiresAt: "2026-12-31T23:59:59.000Z" } } } },
      { method: "DELETE", path: "/api/v1/links/:id", title: "Delete link", permission: "links.write", example: { response: { error: 0, data: { id: "clx1abc", alias: "sale" }, message: "Link deleted" } } },
      { method: "GET", path: "/api/v1/links/:id/stats", title: "Link statistics", permission: "links.read", query: [{ name: "days", type: "number", description: "Window in days (1-365, default 30)." }],
        example: { query: { days: "7" }, response: { error: 0, data: { id: "clx1abc", alias: "sale", days: 7, clicks: 128, uniqueClicks: 97, ...STATS_OBJECT } } } },
      { method: "GET", path: "/api/v1/links/:id/clicks", title: "Recent clicks", permission: "links.read", query: [{ name: "page / limit", type: "number", description: "Pagination (default limit 50)." }],
        example: { response: { error: 0, data: [{ id: "clk1", country: "United States", countryCode: "US", city: "New York", refererHost: "twitter.com", browser: "Chrome", os: "iOS", device: "mobile", language: "en", unique: true, createdAt: "2026-03-02T09:12:00.000Z" }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/links/bulk", title: "Bulk create", permission: "links.write", description: "Up to 100 links per request. Items can be URL strings or objects with the same fields as *Create link*. Top-level fields act as defaults for every item.",
        params: [{ name: "urls", type: "array", required: true, description: "URLs or link objects." }],
        example: { body: { urls: ["https://example.com/a", { url: "https://example.com/b", custom: "b-link" }], campaign: "spring" }, response: { error: 0, data: [LINK_OBJECT], failed: [{ url: "https://example.com/b", message: "This alias is already taken" }], created: 1, total: 2 } } },
      { method: "POST", path: "/api/v1/links/:id/archive", title: "Archive / restore", permission: "links.write", params: [{ name: "archived", type: "boolean", description: "Default true; send false to restore." }],
        example: { body: { archived: true }, response: { error: 0, data: { ...LINK_OBJECT, isArchived: true }, message: "Link archived" } } },
    ],
  },
  {
    id: "campaigns", title: "Campaigns",
    endpoints: [
      { method: "GET", path: "/api/v1/campaigns", title: "List campaigns", permission: "campaigns.read", example: { response: { error: 0, data: [{ id: "clxc", name: "Spring", slug: "spring", color: "#6366f1", isRotator: false, isPublic: false, links: 12, createdAt: "2026-02-01T00:00:00.000Z" }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/campaigns", title: "Create campaign", permission: "campaigns.write", params: [{ name: "name", type: "string", required: true, description: "Campaign name." }, { name: "slug", type: "string", description: "Public slug (auto-generated)." }, { name: "description / color", type: "string", description: "Optional." }, { name: "isPublic", type: "boolean", description: "Publish the campaign page." }, { name: "isRotator", type: "boolean", description: "Enable the link rotator; `rotatorAlias` + `rotatorMode` (sequential | random | weighted)." }],
        example: { body: { name: "Spring", isRotator: true, rotatorMode: "random" }, response: { error: 0, data: { id: "clxc", name: "Spring", slug: "spring", isRotator: true, rotatorAlias: "k3Qz9a", rotatorUrl: "https://sho.rt/k3Qz9a", rotatorMode: "random" } } } },
      { method: "GET", path: "/api/v1/campaigns/:id", title: "Get campaign", permission: "campaigns.read", description: "Includes up to 100 links.", example: { response: { error: 0, data: { id: "clxc", name: "Spring", slug: "spring", links: [LINK_OBJECT] } } } },
      { method: "PUT", path: "/api/v1/campaigns/:id", title: "Update campaign", permission: "campaigns.write", example: { body: { name: "Spring 2026", color: "#10b981" }, response: { error: 0, data: { id: "clxc", name: "Spring 2026", color: "#10b981" } } } },
      { method: "DELETE", path: "/api/v1/campaigns/:id", title: "Delete campaign", permission: "campaigns.write", example: { response: { error: 0, data: { id: "clxc" }, message: "Campaign deleted. Links were kept." } } },
      { method: "POST", path: "/api/v1/campaigns/:id/links", title: "Add links", permission: "campaigns.write", params: [{ name: "links", type: "string[]", required: true, description: "Link ids to attach. Send the same body with DELETE to detach." }], example: { body: { links: ["clx1abc", "clx2def"] }, response: { error: 0, data: { campaignId: "clxc", added: 2 } } } },
      { method: "GET", path: "/api/v1/campaigns/:id/stats", title: "Campaign statistics", permission: "campaigns.read", query: [{ name: "days", type: "number", description: "Window in days." }], example: { response: { error: 0, data: { id: "clxc", name: "Spring", days: 30, links: 12, clicks: 1400, uniqueClicks: 900, topLinks: [{ id: "clx1abc", alias: "sale", clicks: 128, uniqueClicks: 97 }], ...STATS_OBJECT } } } },
    ],
  },
  {
    id: "channels", title: "Channels",
    endpoints: [
      { method: "GET", path: "/api/v1/channels", title: "List channels", permission: "channels.read", example: { response: { error: 0, data: [{ id: "clxch", name: "Social", color: "#6366f1", starred: true, counts: { links: 5, bio: 1, qr: 2 } }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/channels", title: "Create channel", permission: "channels.write", params: [{ name: "name", type: "string", required: true, description: "Channel name." }, { name: "color", type: "string", description: "Hex color." }, { name: "starred", type: "boolean", description: "Pin to top." }], example: { body: { name: "Social", color: "#ec4899" }, response: { error: 0, data: { id: "clxch", name: "Social", color: "#ec4899", starred: false } } } },
      { method: "PUT", path: "/api/v1/channels/:id", title: "Update channel", permission: "channels.write", example: { body: { starred: true }, response: { error: 0, data: { id: "clxch", name: "Social", starred: true } } } },
      { method: "DELETE", path: "/api/v1/channels/:id", title: "Delete channel", permission: "channels.write", example: { response: { error: 0, data: { id: "clxch" }, message: "Channel deleted" } } },
      { method: "POST", path: "/api/v1/channels/:id/assign", title: "Assign resources", permission: "channels.write", params: [{ name: "links", type: "string[]", description: "Link ids." }, { name: "qr", type: "string[]", description: "QR code ids." }, { name: "bio", type: "string[]", description: "Bio page ids." }], example: { body: { links: ["clx1abc"], qr: ["clxq"] }, response: { error: 0, data: { channelId: "clxch", assigned: { links: 1, qr: 1, bio: 0 } } } } },
    ],
  },
  {
    id: "pixels", title: "Pixels",
    endpoints: [
      { method: "GET", path: "/api/v1/pixels", title: "List pixels", permission: "pixels.read", example: { response: { error: 0, data: [{ id: "clxpx", name: "FB main", provider: "facebook", pixelId: "123456789", links: 4 }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/pixels", title: "Create pixel", permission: "pixels.write", params: [{ name: "name", type: "string", required: true, description: "Label." }, { name: "provider", type: "string", required: true, description: "facebook | twitter | bing | google-ads | gtm | ga | snapchat | reddit | quora | pinterest | tiktok | linkedin | adroll | hotjar | clarity | matomo | custom" }, { name: "pixelId", type: "string", required: true, description: "The pixel/tag id (or full snippet for custom)." }], example: { body: { name: "FB main", provider: "facebook", pixelId: "123456789" }, response: { error: 0, data: { id: "clxpx", name: "FB main", provider: "facebook", pixelId: "123456789" } } } },
      { method: "PUT", path: "/api/v1/pixels/:id", title: "Update pixel", permission: "pixels.write", example: { body: { name: "FB retargeting" }, response: { error: 0, data: { id: "clxpx", name: "FB retargeting" } } } },
      { method: "DELETE", path: "/api/v1/pixels/:id", title: "Delete pixel", permission: "pixels.write", example: { response: { error: 0, data: { id: "clxpx" }, message: "Pixel deleted" } } },
    ],
  },
  {
    id: "domains", title: "Domains",
    endpoints: [
      { method: "GET", path: "/api/v1/domains", title: "List domains", permission: "domains.read", description: "Your custom domains plus public domains provided by the site.", example: { response: { error: 0, data: [{ id: "clxd", domain: "go.example.com", status: "active", isPublic: false, own: true, links: 40 }], pagination: PAGINATION, main: "sho.rt" } } },
      { method: "POST", path: "/api/v1/domains", title: "Add domain", permission: "domains.write", params: [{ name: "domain", type: "string", required: true, description: "Hostname, e.g. go.example.com (point an A/CNAME record to the main domain)." }, { name: "rootRedirect", type: "string", description: "Where the bare domain redirects." }, { name: "notFoundRedirect", type: "string", description: "Fallback for unknown aliases." }], example: { body: { domain: "go.example.com", rootRedirect: "https://example.com" }, response: { error: 0, data: { id: "clxd", domain: "go.example.com", status: "active" }, dns: { type: "A or CNAME", target: "sho.rt", txtVerification: null } } } },
      { method: "DELETE", path: "/api/v1/domains/:id", title: "Delete domain", permission: "domains.write", example: { response: { error: 0, data: { id: "clxd", domain: "go.example.com" }, message: "Domain deleted. Links on it now use the main domain." } } },
    ],
  },
  {
    id: "splash", title: "Splash pages & overlays",
    endpoints: [
      { method: "GET", path: "/api/v1/splash", title: "List splash pages", permission: "splash.read", example: { response: { error: 0, data: [{ id: "clxs", name: "Promo splash", title: "Wait for it", countdown: 5, isDefault: false, links: 3 }], pagination: PAGINATION } } },
      { method: "GET", path: "/api/v1/overlays", title: "List overlays", permission: "overlays.read", example: { response: { error: 0, data: [{ id: "clxo", name: "Newsletter CTA", type: "newsletter", position: "bottom-left", links: 2 }], pagination: PAGINATION } } },
    ],
  },
  {
    id: "qr", title: "QR codes",
    endpoints: [
      { method: "GET", path: "/api/v1/qr", title: "List QR codes", permission: "qr.read", query: [{ name: "search / type / channel", type: "string", description: "Filters." }], example: { response: { error: 0, data: [{ id: "clxq", name: "Menu", type: "url", data: { url: "https://example.com/menu" }, content: "https://sho.rt/Qx8Ab2Cd", target: "https://example.com/menu", dynamic: true, alias: "Qx8Ab2Cd", scanUrl: "https://sho.rt/Qx8Ab2Cd", image: "https://sho.rt/api/qr/clxq/download?format=svg", scans: 12 }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/qr", title: "Create QR code", permission: "qr.write", params: [{ name: "type", type: "string", required: true, description: "url | text | email | phone | sms | wifi | vcard | location | event | app | crypto | whatsapp | paypal | link | bio" }, { name: "data", type: "object|string", required: true, description: "Type specific: url→{url}; text→{text}; email→{email,subject,body}; phone→{phone}; sms→{phone,message}; wifi→{ssid,password,encryption:WPA|WEP|nopass,hidden}; vcard→{firstName,lastName,phone,mobile,email,org,title,website,street,city,state,zip,country,note}; location→{lat,lng}; event→{title,start,end,location,description,url}; app→{url,ios,android,fallback}; crypto→{coin,address,amount,label}; whatsapp→{phone,message}; paypal→{username,amount,currency}; link→{linkId}; bio→{bioPageId}. A plain string is accepted for url/text." }, { name: "name", type: "string", description: "Label." }, { name: "style", type: "object", description: "{dots: square|rounded|dots|classy|classy-rounded|extra-rounded, corners: square|extra-rounded|dot, cornerDots: square|dot, color, gradient:{type,rotation,from,to}, bg, logo, logoSize, frame: none|simple|label-bottom|label-top|badge, frameText, frameColor, margin, size, ecLevel, template} — requires advanced QR." }, { name: "dynamic", type: "boolean", description: "Dynamic (trackable, editable) code that encodes a short tracking URL; default per plan. Only url, link, bio, app, whatsapp, paypal style types can be dynamic." }, { name: "channel", type: "string", description: "Channel id." }],
        example: { body: { type: "wifi", name: "Office Wi-Fi", data: { ssid: "Office", password: "s3cret", encryption: "WPA" }, dynamic: false, style: { color: "#111827", dots: "rounded" } }, response: { error: 0, data: { id: "clxq", name: "Office Wi-Fi", type: "wifi", data: { ssid: "Office", password: "s3cret", encryption: "WPA" }, content: "WIFI:T:WPA;S:Office;P:s3cret;;", dynamic: false, image: "https://sho.rt/api/qr/clxq/download?format=svg", scans: 0 } } } },
      { method: "GET", path: "/api/v1/qr/:id", title: "Get QR code", permission: "qr.read", example: { response: { error: 0, data: { id: "clxq", name: "Menu", type: "url", data: { url: "https://example.com/menu" }, content: "https://sho.rt/Qx8Ab2Cd", dynamic: true, scans: 12 } } } },
      { method: "PUT", path: "/api/v1/qr/:id", title: "Update QR code", permission: "qr.write", description: "Same fields as create. Changing `data` of a dynamic code updates where scans go without reprinting.", example: { body: { data: { url: "https://example.com/menu-v2" } }, response: { error: 0, data: { id: "clxq", data: { url: "https://example.com/menu-v2" }, target: "https://example.com/menu-v2" } } } },
      { method: "DELETE", path: "/api/v1/qr/:id", title: "Delete QR code", permission: "qr.write", example: { response: { error: 0, data: { id: "clxq" }, message: "QR code deleted" } } },
      { method: "GET", path: "/api/v1/qr/:id/stats", title: "QR statistics", permission: "qr.read", query: [{ name: "days", type: "number", description: "Window in days." }], example: { response: { error: 0, data: { id: "clxq", name: "Menu", dynamic: true, days: 30, scans: 12, ...STATS_OBJECT } } } },
      { method: "GET", path: "/api/v1/qr/:id/image", title: "QR image", permission: "qr.read", query: [{ name: "format", type: "string", description: "svg (default) | png | jpg | webp | pdf" }, { name: "size", type: "number", description: "Pixel size for raster formats." }], description: "Responds with a 302 redirect to the rendered image at `/api/qr/:id/download`.", example: { query: { format: "png", size: "600" }, response: "302 Location: https://sho.rt/api/qr/clxq/download?format=png&size=600" } },
    ],
  },
  {
    id: "bio", title: "Bio pages",
    endpoints: [
      { method: "GET", path: "/api/v1/bio", title: "List bio pages", permission: "bio.read", example: { response: { error: 0, data: [{ id: "clxb", alias: "jane", url: "https://sho.rt/jane", name: "Jane", theme: "default", views: 340, uniqueViews: 200, blockCount: 6 }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/bio", title: "Create bio page", permission: "bio.write", params: [{ name: "alias", type: "string", required: true, description: "Page alias." }, { name: "name / bio / avatar / cover", type: "string", description: "Profile fields." }, { name: "theme", type: "string", description: "Theme slug." }, { name: "layout / buttonStyle / font / colors / socials / seo", type: "mixed", description: "Design options (see Update)." }, { name: "domain", type: "string", description: "Custom domain id/hostname (plan feature)." }, { name: "blocks", type: "array", description: "`[{type, title, url, content}]` created in order." }],
        example: { body: { alias: "jane", name: "Jane Doe", bio: "Designer & maker", theme: "sunset", blocks: [{ type: "link", title: "Portfolio", url: "https://jane.design" }, { type: "youtube", title: "Latest video", url: "https://youtube.com/watch?v=abc" }] }, response: { error: 0, data: { id: "clxb", alias: "jane", url: "https://sho.rt/jane", name: "Jane Doe", blocks: [{ id: "blk1", type: "link", title: "Portfolio", url: "https://jane.design", order: 0, clicks: 0, enabled: true }] } } } },
      { method: "GET", path: "/api/v1/bio/:id", title: "Get bio page", permission: "bio.read", description: "Includes blocks.", example: { response: { error: 0, data: { id: "clxb", alias: "jane", blocks: [] } } } },
      { method: "PUT", path: "/api/v1/bio/:id", title: "Update bio page", permission: "bio.write", params: [{ name: "alias, name, bio, avatar, cover, theme", type: "string", description: "Profile & theme." }, { name: "layout", type: "string", description: "centered | left | split | card | grid" }, { name: "buttonStyle", type: "string", description: "rounded | square | pill | outline | shadow | frosted | hard-shadow" }, { name: "colors", type: "object", description: "{bg, bgGradient, text, button, buttonText, link, animation}" }, { name: "socials", type: "array", description: "[{network, url}]" }, { name: "seo", type: "object", description: "{title, description, image, noindex}" }, { name: "password / ageGate / sensitive / nsfwWarning / newsletterGate / hideBranding / status", type: "mixed", description: "Access & misc." }],
        example: { body: { theme: "midnight", socials: [{ network: "instagram", url: "https://instagram.com/jane" }] }, response: { error: 0, data: { id: "clxb", theme: "midnight" } } } },
      { method: "DELETE", path: "/api/v1/bio/:id", title: "Delete bio page", permission: "bio.write", example: { response: { error: 0, data: { id: "clxb", alias: "jane" }, message: "Bio page deleted" } } },
      { method: "GET", path: "/api/v1/bio/:id/stats", title: "Bio statistics", permission: "bio.read", example: { response: { error: 0, data: { id: "clxb", alias: "jane", days: 30, views: 340, uniqueViews: 200, blocks: [{ id: "blk1", type: "link", title: "Portfolio", clicks: 80 }], ...STATS_OBJECT } } } },
      { method: "POST", path: "/api/v1/bio/:id/blocks", title: "Add block", permission: "bio.write", params: [{ name: "type", type: "string", required: true, description: "link | heading | text | image | gallery | video | youtube | spotify | tiktok | twitter | instagram | email | phone | vcard | contact | newsletter | faq | poll | countdown | map | calendly | divider | html | product | paypal | file | … (see schema)" }, { name: "title / url", type: "string", description: "Label and target." }, { name: "content", type: "object", description: "Block-specific config." }, { name: "order / enabled / scheduleStart / scheduleEnd / countries / languages / sensitive / gated / animation", type: "mixed", description: "Optional." }],
        example: { body: { type: "link", title: "Shop", url: "https://shop.example.com" }, response: { error: 0, data: { id: "blk2", type: "link", title: "Shop", url: "https://shop.example.com", order: 1, clicks: 0, enabled: true } } } },
      { method: "PUT", path: "/api/v1/bio/:id/blocks/:blockId", title: "Update block", permission: "bio.write", example: { body: { title: "Shop now", enabled: false }, response: { error: 0, data: { id: "blk2", title: "Shop now", enabled: false } } } },
      { method: "DELETE", path: "/api/v1/bio/:id/blocks/:blockId", title: "Delete block", permission: "bio.write", example: { response: { error: 0, data: { id: "blk2" }, message: "Block deleted" } } },
    ],
  },
  {
    id: "files", title: "Files",
    endpoints: [
      { method: "GET", path: "/api/v1/files", title: "List hosted files", permission: "files.read", example: { response: { error: 0, data: [{ id: "clxf", alias: "brochure", url: "https://sho.rt/f/brochure", name: "brochure.pdf", size: 204800, mime: "application/pdf", downloads: 15 }], pagination: PAGINATION, storageUsed: 204800, storageLimitMb: 500 } } },
      { method: "DELETE", path: "/api/v1/files/:id", title: "Delete file", permission: "files.write", example: { response: { error: 0, data: { id: "clxf" }, message: "File deleted" } } },
    ],
  },
  {
    id: "teams", title: "Teams",
    endpoints: [
      { method: "GET", path: "/api/v1/teams", title: "List teams", permission: "teams.read", description: "Teams you own and teams you belong to, with members and permissions.", example: { response: { error: 0, data: { owned: [{ id: "clxt", name: "Marketing", role: "owner", members: [{ userId: "clx9", username: "bob", role: "member", permissions: { links: ["view", "create"] } }] }], memberOf: [], activeTeamId: null } } } },
    ],
  },
  {
    id: "admin", title: "Admin", description: "Only API keys belonging to administrators can call these endpoints.",
    endpoints: [
      { method: "GET", path: "/api/v1/users", title: "List users", permission: "users.read", admin: true, query: [{ name: "search / plan / status / role", type: "string", description: "Filters (status: active | banned | pending)." }], example: { response: { error: 0, data: [{ id: "clx0", username: "jane", email: "jane@example.com", role: "user", status: "active", plan: { id: "clxp", name: "Pro", slug: "pro" }, planExpires: "2027-01-01T00:00:00.000Z", lastLoginAt: "2026-03-01T08:00:00.000Z" }], pagination: PAGINATION } } },
      { method: "POST", path: "/api/v1/users", title: "Create user", permission: "users.write", admin: true, params: [{ name: "email", type: "string", required: true, description: "Email." }, { name: "password", type: "string", required: true, description: "Min 6 chars." }, { name: "username", type: "string", description: "Letters and numbers; derived from the email when omitted." }, { name: "planId", type: "string", description: "Plan id or slug (free plan by default)." }, { name: "planExpires", type: "string", description: "ISO date." }, { name: "role", type: "string", description: "user | admin | custom role slug." }, { name: "name", type: "string", description: "Display name." }],
        example: { body: { email: "bob@example.com", password: "S3cret!!", username: "bob", planId: "pro", planExpires: "2027-01-01" }, response: { error: 0, data: { id: "clx9", username: "bob", email: "bob@example.com", role: "user", plan: { slug: "pro" }, apiKey: "pus_…" } } } },
      { method: "GET", path: "/api/v1/users/:id", title: "Get user", permission: "users.read", admin: true, description: "`:id` accepts id, username or email.", example: { response: { error: 0, data: { id: "clx9", username: "bob", counts: { links: 3, bio: 0, qr: 1, payments: 1 } } } } },
      { method: "PUT", path: "/api/v1/users/:id", title: "Update user", permission: "users.write", admin: true, params: [{ name: "name, email, password, planId, planExpires, role, status, verified, aiCredits", type: "mixed", description: "Any subset." }], example: { body: { planId: "pro", planExpires: "2027-06-01", status: "active" }, response: { error: 0, data: { id: "clx9", plan: { slug: "pro" }, planExpires: "2027-06-01T00:00:00.000Z" } } } },
      { method: "DELETE", path: "/api/v1/users/:id", title: "Delete user", permission: "users.write", admin: true, example: { response: { error: 0, data: { id: "clx9", username: "bob" }, message: "User deleted with all their data" } } },
      { method: "GET", path: "/api/v1/plans", title: "List plans", permission: "plans.read", admin: true, example: { response: { error: 0, data: [{ id: "clxp", name: "Pro", slug: "pro", priceMonthly: 29, priceYearly: 290, limits: { limitLinks: -1, limitDomains: -1 }, features: { api: true }, users: 42 }] } } },
      { method: "GET", path: "/api/v1/payments", title: "List payments", permission: "payments.read", admin: true, query: [{ name: "user / status / gateway", type: "string", description: "Filters." }], example: { response: { error: 0, data: [{ id: "clxpay", userId: "clx9", user: { username: "bob" }, plan: { slug: "pro" }, gateway: "stripe", amount: 29, currency: "USD", interval: "monthly", status: "completed", invoiceNumber: "INV-…", createdAt: "2026-03-01T00:00:00.000Z" }], pagination: PAGINATION } } },
    ],
  },
  {
    id: "public", title: "Public & session endpoints", description: "These endpoints power the homepage, bookmarklet and browser extension. They accept an API key, a logged-in browser session, or (when the site allows it) anonymous requests.",
    endpoints: [
      { method: "POST", path: "/api/shorten", title: "Quick shorten", auth: "session-or-anonymous", params: [{ name: "url", type: "string", required: true, description: "Destination." }, { name: "alias", type: "string", description: "Custom alias." }, { name: "domainId", type: "string", description: "Domain id." }, { name: "redirectType", type: "string", description: "direct | frame | splash." }, { name: "captcha", type: "string", description: "Captcha token — required for anonymous requests when the admin enabled captcha on shorten." }],
        description: "Anonymous callers are limited to 20 requests per minute per IP.",
        example: { body: { url: "https://example.com/very/long/path" }, response: { error: 0, id: "clx1abc", alias: "k3Qz9a", short: "https://sho.rt/k3Qz9a", url: "https://example.com/very/long/path", status: "active", anonymous: true } } },
      { method: "GET", path: "/api/shorten", title: "Quick shorten (GET)", auth: "session-or-anonymous", query: [{ name: "url", type: "string", required: true, description: "Destination." }, { name: "alias", type: "string", description: "Custom alias." }, { name: "format", type: "string", description: "json (default) | text — text returns only the short URL." }],
        example: { query: { url: "https://example.com", format: "text" }, response: "https://sho.rt/k3Qz9a" } },
      { method: "GET", path: "/api/unshorten", title: "Unshorten", auth: "public", query: [{ name: "url", type: "string", required: true, description: "Short URL or alias." }], example: { query: { url: "https://sho.rt/sale" }, response: { error: 0, alias: "sale", short: "https://sho.rt/sale", url: "https://example.com/spring-sale", title: "Spring sale", description: null, expired: false, createdAt: "2026-03-01T10:00:00.000Z" } } },
    ],
  },
];

export const WEBHOOK_EVENTS = [
  { event: "link.created", description: "A short link was created (dashboard, API, Slack, import).", payload: { event: "link.created", data: { id: "clx1abc", alias: "sale", short: "https://sho.rt/sale", url: "https://example.com/spring-sale" }, timestamp: "2026-03-01T10:00:00.000Z" } },
  { event: "link.clicked", description: "A visitor clicked one of your links (bots excluded).", payload: { event: "link.clicked", data: { id: "clx1abc", alias: "sale", country: "US", device: "mobile", referer: "twitter.com" }, timestamp: "2026-03-02T09:12:00.000Z" } },
  { event: "bio.viewed", description: "A bio page was viewed.", payload: { event: "bio.viewed", data: { id: "clxb", alias: "jane", country: "DE", device: "desktop" }, timestamp: "2026-03-02T09:12:00.000Z" } },
  { event: "qr.scanned", description: "A dynamic QR code was scanned.", payload: { event: "qr.scanned", data: { id: "clxq", alias: "Qx8Ab2Cd", country: "FR", device: "mobile" }, timestamp: "2026-03-02T09:12:00.000Z" } },
  { event: "link.updated / link.deleted", description: "A link was edited or removed.", payload: { event: "link.deleted", data: { id: "clx1abc", alias: "sale", url: "https://example.com/spring-sale" }, timestamp: "2026-03-03T09:12:00.000Z" } },
];

export const PERMISSION_KEYS = ["account.read", "account.write", "links.read", "links.write", "campaigns.read", "campaigns.write", "channels.read", "channels.write", "pixels.read", "pixels.write", "domains.read", "domains.write", "splash.read", "overlays.read", "qr.read", "qr.write", "bio.read", "bio.write", "files.read", "files.write", "teams.read", "users.read", "users.write", "plans.read", "payments.read"];

export const CLIENT_LIBRARIES = [
  { name: "PHP", path: "integrations/api-clients/php/PremiumURLShortener.php", snippet: `require "PremiumURLShortener.php";\n$api = new PremiumURLShortener("https://sho.rt", "YOUR_API_KEY");\n$api->setCustom("sale");\necho $api->shorten("https://example.com/spring-sale"); // https://sho.rt/sale\nprint_r($api->stats("clx1abc", 7));` },
  { name: "Node.js", path: "integrations/api-clients/node/client.js", snippet: `const { PremiumURLShortener } = require("./client");\nconst api = new PremiumURLShortener({ baseUrl: "https://sho.rt", apiKey: "YOUR_API_KEY" });\nconst link = await api.links.create({ url: "https://example.com", custom: "sale" });\nconsole.log(link.short);` },
  { name: "WordPress plugin", path: "integrations/wordpress/premium-url-shortener", snippet: `[shortlink url="https://example.com/post"]  // shortcode\n// Auto-shortens on publish and serves wp_get_shortlink() from your domain.` },
  { name: "Chrome extension", path: "integrations/chrome-extension", snippet: `Load unpacked → set Site URL + API key in Options → click the toolbar icon or right-click "Shorten this page/link".` },
  { name: "Bookmarklet", path: "public/bookmarklet.js", snippet: `javascript:(function(){var s=document.createElement('script');s.src='https://sho.rt/bookmarklet.js?'+Date.now();document.body.appendChild(s);})();` },
];

export function curlFor(e: ApiEndpoint, base: string) {
  if (e.example.curl) return e.example.curl;
  const q = e.example.query ? "?" + new URLSearchParams(e.example.query).toString() : "";
  const path = e.path.replace(":blockId", "blk2").replace(":id", "clx1abc");
  const lines = [`curl -X ${e.method} "${base}${path}${q}"`];
  if (e.auth !== "public") lines.push(`  -H "Authorization: Bearer YOUR_API_KEY"`);
  if (e.example.body !== undefined) lines.push(`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(e.example.body)}'`);
  return lines.join(" \\\n");
}

export function pretty(v: unknown) {
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

/** Renders the whole catalog as Markdown (used to produce docs/API.md). */
export function renderApiMarkdown(base: string, siteName = "Premium URL Shortener") {
  const out: string[] = [];
  out.push(`# ${siteName} — Developer API`, "", `Base URL: \`${base}\``, "", "## Authentication", "",
    "Every `/api/v1` request needs an API key. Create keys in **Dashboard → Settings → API** (each key can be restricted to permissions such as `links.read` or `qr.*`). Send it as a header:", "",
    "```", "Authorization: Bearer YOUR_API_KEY", "```", "", "`?key=YOUR_API_KEY` is accepted as a fallback for GET requests. API access must be included in your plan.", "",
    "## Envelope, errors & pagination", "",
    "Successful responses return `{ \"error\": 0, ... }`; failures return `{ \"error\": 1, \"message\": \"...\" }` with a matching HTTP status:", "",
    "| Status | Meaning |", "| --- | --- |", "| 400 | Validation error (message explains) |", "| 401 | Missing/invalid API key |", "| 402 | Plan limit or feature not included |", "| 403 | Permission denied (key permission, admin only, inactive account) |", "| 404 | Resource not found |", "| 409 | Conflict (alias/slug taken) |", "| 429 | Rate limit exceeded |", "| 503 | API disabled |", "",
    "List endpoints accept `?page=` and `?limit=` (max 100) and return `{ data: [...], pagination: { page, limit, total, pages } }`.", "",
    "## Rate limits", "", "Requests are limited per API key per minute (the admin configures the value under Settings → API; default 60). `429` is returned when exceeded. Anonymous `/api/shorten` calls are limited to 20 per minute per IP.", "",
    "## Permissions", "", "API keys carry a list of permissions. `*` grants everything; `links.*` grants every link permission. Endpoint permissions:", "", PERMISSION_KEYS.map((p) => `\`${p}\``).join(", "), "");
  for (const s of API_SECTIONS) {
    out.push(`## ${s.title}`, "");
    if (s.description) out.push(s.description, "");
    for (const e of s.endpoints) {
      out.push(`### ${e.method} ${e.path}`, "", `**${e.title}**${e.permission ? ` — permission \`${e.permission}\`` : ""}${e.admin ? " — *admin only*" : ""}${e.auth === "public" ? " — public" : e.auth === "session-or-anonymous" ? " — API key, session or anonymous" : ""}`, "");
      if (e.description) out.push(e.description, "");
      const table = (title: string, rows?: ApiParam[]) => {
        if (!rows?.length) return;
        out.push(`${title}:`, "", "| Name | Type | Description |", "| --- | --- | --- |");
        for (const p of rows) out.push(`| \`${p.name}\`${p.required ? " *" : ""} | ${p.type} | ${p.description.replace(/\|/g, "\\|")} |`);
        out.push("");
      };
      table("Query parameters", e.query);
      table("Body parameters", e.params);
      out.push("Example request:", "", "```bash", curlFor(e, base), "```", "", "Example response:", "", "```json", pretty(e.example.response), "```", "");
    }
  }
  out.push("## Webhooks (Zapier & custom)", "", "Create webhooks under **Dashboard → Tools → Webhooks** (or connect Zapier and pick the events). Each event is delivered as `POST` JSON with a `X-Signature` header containing `hex(HMAC-SHA256(secret, body))` when a secret is set.", "");
  for (const w of WEBHOOK_EVENTS) out.push(`### ${w.event}`, "", w.description, "", "```json", pretty(w.payload), "```", "");
  out.push("## Slack", "", "Admins enable Slack under Settings → Integrations and add a slash command whose Request URL is `" + base + "/api/webhook/slack`. Users connect their Slack account under Dashboard → Tools (a `Webhook` row with provider `slack`, url `slack` and secret `TEAM_ID:USER_ID`) and then run `/shorten https://example.com [alias]`.", "");
  out.push("## Cron", "", "Scheduled jobs live under `/api/cron/<job>` and are protected by `Authorization: Bearer $CRON_SECRET` (or `?secret=`). Jobs: `expire-plans`, `expire-links`, `cleanup`, `subscriptions`, `notify-expiring`, `imports`, `reset-ai-credits`, `storage-sync`, `backup`. `GET /api/cron` runs them all. `pnpm cron` (scripts/cron.ts) calls every job; use `pnpm cron --loop 10` for a sidecar loop.", "");
  out.push("## Client libraries & integrations", "");
  for (const c of CLIENT_LIBRARIES) out.push(`### ${c.name}`, "", `Path: \`${c.path}\``, "", "```", c.snippet, "```", "");
  return out.join("\n");
}
