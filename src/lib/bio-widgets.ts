/** Bio page ("link in bio") widget catalogue, appearance presets, built-in templates and pure helpers.
 *  Isomorphic: no server-only imports (used by the builder, the renderer and server actions). */
import type { BioBlock, BioPage } from "@prisma/client";
import { json } from "./utils";

// ------------------------------------------------------------------ Widget definitions
export type FieldType = "text" | "url" | "textarea" | "number" | "select" | "upload" | "color" | "date" | "datetime" | "list" | "toggle" | "email" | "tel" | "giphy" | "markdown" | "range";
export interface WidgetField { key: string; label: string; type?: FieldType; placeholder?: string; hint?: string; options?: { value: string; label: string }[]; accept?: string; itemFields?: WidgetField[]; min?: number; max?: number; step?: number; unit?: string }
export type WidgetCategory = "basic" | "media" | "social" | "embed" | "forms" | "commerce" | "advanced";
export interface WidgetDef { type: string; label: string; category: WidgetCategory; description: string; keywords?: string; fields: WidgetField[]; feature?: "customCss" }

const F = {
  title: (label = "Title"): WidgetField => ({ key: "title", label, placeholder: label }),
  url: (label = "URL", placeholder = "https://"): WidgetField => ({ key: "url", label, type: "url", placeholder }),
  thumb: (label = "Thumbnail"): WidgetField => ({ key: "thumbnail", label, type: "upload", accept: "image/*" }),
  handle: (label: string): WidgetField => ({ key: "url", label, type: "url", placeholder: "https://" }),
};

export const WIDGETS: WidgetDef[] = [
  // basic
  { type: "link", label: "Link", category: "basic", description: "A button that opens a URL", keywords: "button url", fields: [F.title(), F.url(), F.thumb(), { key: "icon", label: "Icon (lucide name)", placeholder: "Link" }, { key: "newTab", label: "Open in new tab", type: "toggle" }] },
  { type: "featured", label: "Featured link", category: "basic", description: "Large card with image, title and description", keywords: "card big", fields: [F.title(), F.url(), F.thumb("Image"), { key: "description", label: "Description", type: "textarea" }, { key: "buttonText", label: "Button text", placeholder: "Open" }] },
  { type: "heading", label: "Heading", category: "basic", description: "Section title", fields: [F.title("Heading"), { key: "size", label: "Size", type: "select", options: [{ value: "lg", label: "Large" }, { value: "md", label: "Medium" }, { value: "sm", label: "Small" }] }] },
  { type: "text", label: "Text", category: "basic", description: "Paragraph with basic markdown", keywords: "paragraph markdown rich", fields: [{ key: "text", label: "Text", type: "markdown", hint: "Supports **bold**, *italic*, [links](https://) and line breaks" }, { key: "align", label: "Align", type: "select", options: [{ value: "center", label: "Center" }, { value: "left", label: "Left" }] }] },
  { type: "divider", label: "Divider", category: "basic", description: "Horizontal separator or spacer", keywords: "separator space", fields: [{ key: "style", label: "Style", type: "select", options: [{ value: "line", label: "Line" }, { value: "dots", label: "Dots" }, { value: "space", label: "Blank space" }] }] },
  // media
  { type: "image", label: "Image", category: "media", description: "Single image, optionally linked", keywords: "photo picture", fields: [{ key: "url", label: "Image", type: "upload", accept: "image/*" }, { key: "link", label: "Link (optional)", type: "url" }, F.title("Caption"), { key: "rounded", label: "Rounded corners", type: "toggle" }] },
  { type: "gallery", label: "Gallery", category: "media", description: "Grid of images", keywords: "photos grid", fields: [{ key: "images", label: "Images", type: "list", itemFields: [{ key: "url", label: "Image", type: "upload", accept: "image/*" }, { key: "link", label: "Link", type: "url" }] }, { key: "columns", label: "Columns", type: "select", options: [{ value: "2", label: "2" }, { value: "3", label: "3" }] }] },
  { type: "carousel", label: "Carousel", category: "media", description: "Swipeable image slider", keywords: "slider swipe", fields: [{ key: "images", label: "Slides", type: "list", itemFields: [{ key: "url", label: "Image", type: "upload", accept: "image/*" }, { key: "caption", label: "Caption" }, { key: "link", label: "Link", type: "url" }] }] },
  { type: "video", label: "Video", category: "media", description: "Upload and play a video file", keywords: "mp4 upload", fields: [{ key: "url", label: "Video file", type: "upload", accept: "video/*" }, F.title("Caption"), { key: "poster", label: "Poster image", type: "upload", accept: "image/*" }] },
  { type: "audio", label: "Audio", category: "media", description: "Audio player", keywords: "mp3 podcast", fields: [{ key: "url", label: "Audio file", type: "upload", accept: "audio/*" }, F.title()] },
  { type: "file", label: "File download", category: "media", description: "Upload a file visitors can download", keywords: "download attachment", fields: [{ key: "url", label: "File", type: "upload" }, F.title("Button label"), { key: "description", label: "Description" }] },
  { type: "pdf", label: "PDF", category: "media", description: "Embed a PDF document", fields: [{ key: "url", label: "PDF file", type: "upload", accept: "application/pdf" }, F.title()] },
  { type: "giphy", label: "GIPHY", category: "media", description: "Search and add a GIF", keywords: "gif animated", fields: [{ key: "url", label: "GIF", type: "giphy" }, F.title("Caption")] },
  // embeds
  { type: "youtube", label: "YouTube", category: "embed", description: "Embed a YouTube video", fields: [F.url("YouTube URL", "https://youtube.com/watch?v=")] },
  { type: "vimeo", label: "Vimeo", category: "embed", description: "Embed a Vimeo video", fields: [F.url("Vimeo URL", "https://vimeo.com/")] },
  { type: "spotify", label: "Spotify", category: "embed", description: "Track, album, playlist or podcast", keywords: "music podcast", fields: [F.url("Spotify URL", "https://open.spotify.com/…")] },
  { type: "soundcloud", label: "SoundCloud", category: "embed", description: "Embed a SoundCloud track", fields: [F.url("SoundCloud URL", "https://soundcloud.com/…")] },
  { type: "applemusic", label: "Apple Music", category: "embed", description: "Embed an Apple Music song or album", fields: [F.url("Apple Music URL", "https://music.apple.com/…")] },
  { type: "tiktok", label: "TikTok", category: "embed", description: "Embed a TikTok video or profile", fields: [F.url("TikTok URL", "https://www.tiktok.com/@user/video/…")] },
  { type: "twitter", label: "X / Twitter post", category: "embed", description: "Embed a post", keywords: "tweet", fields: [F.url("Post URL", "https://x.com/user/status/…")] },
  { type: "instagram", label: "Instagram post", category: "embed", description: "Embed an Instagram post or reel", fields: [F.url("Post URL", "https://www.instagram.com/p/…")] },
  { type: "facebook", label: "Facebook post", category: "embed", description: "Embed a Facebook post or video", fields: [F.url("Post URL", "https://www.facebook.com/…")] },
  { type: "linkedin", label: "LinkedIn post", category: "embed", description: "Embed a LinkedIn post", fields: [F.url("Post URL", "https://www.linkedin.com/posts/…")] },
  { type: "threads", label: "Threads post", category: "embed", description: "Embed a Threads post", fields: [F.url("Post URL", "https://www.threads.net/@user/post/…")] },
  { type: "reddit", label: "Reddit", category: "embed", description: "Link to a subreddit or post", fields: [F.title(), F.url("Reddit URL", "https://www.reddit.com/r/…")] },
  { type: "pinterest", label: "Pinterest", category: "embed", description: "Embed a pin or board", fields: [F.url("Pinterest URL", "https://www.pinterest.com/…")] },
  { type: "snapchat", label: "Snapchat", category: "social", description: "Add me on Snapchat button", fields: [{ key: "username", label: "Username" }, F.title("Button label")] },
  { type: "telegram", label: "Telegram", category: "social", description: "Telegram chat/channel button", fields: [{ key: "username", label: "Username or channel" }, F.title("Button label")] },
  { type: "whatsapp", label: "WhatsApp", category: "social", description: "Chat on WhatsApp with a prefilled message", fields: [{ key: "phone", label: "Phone (international)", type: "tel", placeholder: "15550000000" }, { key: "message", label: "Prefilled message", type: "textarea" }, F.title("Button label")] },
  { type: "discord", label: "Discord", category: "social", description: "Discord invite button or widget", fields: [F.url("Invite URL", "https://discord.gg/…"), { key: "serverId", label: "Server ID (widget)", hint: "Optional: shows the server widget" }, F.title("Button label")] },
  { type: "twitch", label: "Twitch", category: "embed", description: "Embed a Twitch channel", fields: [{ key: "channel", label: "Channel name" }] },
  { type: "github", label: "GitHub", category: "social", description: "GitHub profile or repository card", fields: [{ key: "repo", label: "user/repo or username", placeholder: "vercel/next.js" }, F.title("Label")] },
  { type: "email", label: "Email", category: "social", description: "Send me an email button", fields: [{ key: "email", label: "Email address", type: "email" }, { key: "subject", label: "Subject" }, F.title("Button label")] },
  { type: "phone", label: "Phone", category: "social", description: "Call me button", fields: [{ key: "phone", label: "Phone number", type: "tel" }, F.title("Button label")] },
  { type: "vcard", label: "vCard", category: "social", description: "Save contact (.vcf download)", keywords: "contact card", fields: [{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "org", label: "Company" }, { key: "jobTitle", label: "Job title" }, { key: "phone", label: "Phone", type: "tel" }, { key: "email", label: "Email", type: "email" }, { key: "website", label: "Website", type: "url" }, { key: "address", label: "Address" }, { key: "photo", label: "Photo", type: "upload", accept: "image/*" }, F.title("Button label")] },
  // forms
  { type: "contact", label: "Contact form", category: "forms", description: "Name, email and message form", fields: [F.title("Form title"), { key: "buttonText", label: "Button text", placeholder: "Send" }, { key: "successText", label: "Success message", placeholder: "Thanks! We'll get back to you." }] },
  { type: "newsletter", label: "Newsletter", category: "forms", description: "Email capture (Mailchimp sync when configured)", keywords: "subscribe email", fields: [F.title("Title"), { key: "description", label: "Description" }, { key: "buttonText", label: "Button text", placeholder: "Subscribe" }, { key: "successText", label: "Success message", placeholder: "You are subscribed!" }] },
  { type: "faq", label: "FAQ", category: "forms", description: "Expandable questions and answers", fields: [F.title(), { key: "items", label: "Questions", type: "list", itemFields: [{ key: "q", label: "Question" }, { key: "a", label: "Answer", type: "textarea" }] }] },
  { type: "poll", label: "Poll", category: "forms", description: "Let visitors vote", keywords: "vote survey", fields: [F.title("Question"), { key: "options", label: "Options", type: "list", itemFields: [{ key: "label", label: "Option" }] }, { key: "showResults", label: "Show results after voting", type: "toggle" }] },
  { type: "countdown", label: "Countdown", category: "forms", description: "Countdown to a date", keywords: "timer launch", fields: [F.title(), { key: "date", label: "Date & time", type: "datetime" }, { key: "endText", label: "Text when finished", placeholder: "We're live!" }] },
  { type: "map", label: "Map", category: "embed", description: "Embedded map for an address", keywords: "location address", fields: [{ key: "address", label: "Address or place" }, F.title("Caption")] },
  { type: "calendly", label: "Calendly", category: "embed", description: "Embed a Calendly booking page", fields: [F.url("Calendly URL", "https://calendly.com/…")] },
  { type: "typeform", label: "Typeform", category: "embed", description: "Embed a Typeform", fields: [F.url("Typeform URL", "https://form.typeform.com/to/…")] },
  { type: "eventbrite", label: "Eventbrite", category: "embed", description: "Event tickets button", fields: [F.url("Event URL", "https://www.eventbrite.com/e/…"), F.title("Button label")] },
  { type: "opentable", label: "OpenTable", category: "embed", description: "Reservation button", fields: [F.url("OpenTable URL", "https://www.opentable.com/…"), F.title("Button label")] },
  { type: "booking", label: "Booking", category: "commerce", description: "Dynamic booking link (Calendly, Cal.com, Booksy…)", fields: [F.title("Button label"), F.url("Booking URL"), { key: "description", label: "Description" }] },
  { type: "music", label: "Music smart link", category: "commerce", description: "One block linking to every streaming platform", keywords: "spotify apple youtube smart", fields: [F.title("Song / album"), F.thumb("Cover art"), { key: "spotify", label: "Spotify URL", type: "url" }, { key: "apple", label: "Apple Music URL", type: "url" }, { key: "youtube", label: "YouTube Music URL", type: "url" }, { key: "soundcloud", label: "SoundCloud URL", type: "url" }, { key: "deezer", label: "Deezer URL", type: "url" }, { key: "amazon", label: "Amazon Music URL", type: "url" }] },
  { type: "rss", label: "RSS feed", category: "advanced", description: "Latest items from an RSS feed", keywords: "blog feed news", fields: [F.title(), F.url("Feed URL", "https://example.com/feed.xml"), { key: "count", label: "Items", type: "number", placeholder: "5" }] },
  { type: "html", label: "Custom HTML", category: "advanced", description: "Raw HTML (plan feature)", keywords: "code embed", feature: "customCss", fields: [{ key: "html", label: "HTML", type: "textarea" }] },
  // commerce
  { type: "product", label: "Product", category: "commerce", description: "Product card with price and buy button", keywords: "shop buy", fields: [F.title("Product name"), F.thumb("Image"), { key: "price", label: "Price", placeholder: "$19.99" }, { key: "description", label: "Description", type: "textarea" }, F.url("Buy URL"), { key: "buttonText", label: "Button text", placeholder: "Buy now" }] },
  { type: "paypal", label: "PayPal", category: "commerce", description: "PayPal.me payment button", keywords: "pay tip", fields: [{ key: "username", label: "PayPal.me username" }, { key: "amount", label: "Amount (optional)", type: "number" }, F.title("Button label")] },
  { type: "donation", label: "Donation", category: "commerce", description: "Buy Me a Coffee / Ko-fi / Patreon button", keywords: "coffee kofi tip support", fields: [{ key: "provider", label: "Provider", type: "select", options: [{ value: "buymeacoffee", label: "Buy Me a Coffee" }, { value: "kofi", label: "Ko-fi" }, { value: "patreon", label: "Patreon" }, { value: "custom", label: "Custom URL" }] }, { key: "username", label: "Username" }, F.url("Custom URL"), F.title("Button label")] },
  { type: "app", label: "App download", category: "commerce", description: "App Store / Play Store badges", keywords: "ios android store", fields: [F.title(), { key: "ios", label: "App Store URL", type: "url" }, { key: "android", label: "Play Store URL", type: "url" }] },
  { type: "cookie", label: "Cookie notice", category: "advanced", description: "Cookie consent banner on this page", keywords: "gdpr consent", fields: [{ key: "text", label: "Text", type: "textarea", placeholder: "We use cookies to improve your experience." }, { key: "buttonText", label: "Button text", placeholder: "Got it" }] },
];

export const WIDGET_CATEGORIES: { key: WidgetCategory; label: string }[] = [
  { key: "basic", label: "Basic" }, { key: "media", label: "Media" }, { key: "social", label: "Social" }, { key: "embed", label: "Embeds" },
  { key: "forms", label: "Forms & engagement" }, { key: "commerce", label: "Commerce" }, { key: "advanced", label: "Advanced" },
];

export function widgetDef(type: string) {
  return WIDGETS.find((w) => w.type === type);
}

export const BLOCK_ANIMATIONS = ["", "pulse", "shake", "bounce", "wobble", "glow"];

// ------------------------------------------------------------------ Appearance
export interface BioColors { bg?: string; bgGradient?: string; text?: string; button?: string; buttonText?: string; link?: string; animation?: "" | "gradient" | "particles" }
export interface BioSeo { title?: string; description?: string; image?: string; noindex?: boolean }
export interface BioSocial { network: string; url: string; order?: number }

export interface BioTheme { key: string; label: string; colors: BioColors; preview: string }
export const BIO_THEMES: BioTheme[] = [
  { key: "default", label: "Default", colors: { bg: "#f1f5f9", text: "#0f172a", button: "#0f172a", buttonText: "#ffffff" }, preview: "#f1f5f9" },
  { key: "light", label: "Light", colors: { bg: "#ffffff", text: "#111827", button: "#f3f4f6", buttonText: "#111827" }, preview: "#ffffff" },
  { key: "dark", label: "Dark", colors: { bg: "#0b1120", text: "#f1f5f9", button: "#1f2937", buttonText: "#f9fafb" }, preview: "#0b1120" },
  { key: "sunset", label: "Sunset", colors: { bgGradient: "linear-gradient(135deg,#f43f5e,#f59e0b)", text: "#ffffff", button: "#ffffff", buttonText: "#be123c" }, preview: "linear-gradient(135deg,#f43f5e,#f59e0b)" },
  { key: "ocean", label: "Ocean", colors: { bgGradient: "linear-gradient(160deg,#0ea5e9,#1e3a8a)", text: "#ffffff", button: "rgba(255,255,255,0.15)", buttonText: "#ffffff" }, preview: "linear-gradient(160deg,#0ea5e9,#1e3a8a)" },
  { key: "forest", label: "Forest", colors: { bgGradient: "linear-gradient(160deg,#134e4a,#166534)", text: "#ecfdf5", button: "#a7f3d0", buttonText: "#064e3b" }, preview: "linear-gradient(160deg,#134e4a,#166534)" },
  { key: "candy", label: "Candy", colors: { bgGradient: "linear-gradient(135deg,#fbcfe8,#c7d2fe)", text: "#3b0764", button: "#7c3aed", buttonText: "#ffffff" }, preview: "linear-gradient(135deg,#fbcfe8,#c7d2fe)" },
  { key: "midnight", label: "Midnight", colors: { bgGradient: "linear-gradient(180deg,#111827,#312e81)", text: "#e0e7ff", button: "#6366f1", buttonText: "#ffffff" }, preview: "linear-gradient(180deg,#111827,#312e81)" },
  { key: "peach", label: "Peach", colors: { bgGradient: "linear-gradient(135deg,#ffedd5,#fed7aa)", text: "#7c2d12", button: "#ea580c", buttonText: "#ffffff" }, preview: "linear-gradient(135deg,#ffedd5,#fed7aa)" },
  { key: "mint", label: "Mint", colors: { bg: "#ecfdf5", text: "#064e3b", button: "#10b981", buttonText: "#ffffff" }, preview: "#ecfdf5" },
  { key: "animated-gradient", label: "Animated gradient", colors: { bgGradient: "linear-gradient(-45deg,#ee7752,#e73c7e,#23a6d5,#23d5ab)", text: "#ffffff", button: "rgba(255,255,255,0.2)", buttonText: "#ffffff", animation: "gradient" }, preview: "linear-gradient(-45deg,#ee7752,#e73c7e,#23a6d5,#23d5ab)" },
  { key: "particles", label: "Particles", colors: { bg: "#020617", text: "#f8fafc", button: "#1e293b", buttonText: "#f8fafc", animation: "particles" }, preview: "#020617" },
  { key: "custom", label: "Custom", colors: {}, preview: "conic-gradient(#f43f5e,#f59e0b,#10b981,#3b82f6,#8b5cf6,#f43f5e)" },
];

export const BIO_FONTS = ["Inter", "Roboto", "Poppins", "Montserrat", "Lato", "Nunito", "Raleway", "DM Sans", "Space Grotesk", "Playfair Display", "Merriweather", "Oswald", "Lora", "Quicksand"];
export const BIO_LAYOUTS = [{ key: "centered", label: "Centered" }, { key: "left", label: "Left aligned" }, { key: "split", label: "Split" }, { key: "card", label: "Card" }, { key: "grid", label: "Grid" }];
export const BIO_BUTTON_STYLES = [{ key: "rounded", label: "Rounded" }, { key: "square", label: "Square" }, { key: "pill", label: "Pill" }, { key: "outline", label: "Outline" }, { key: "shadow", label: "Soft shadow" }, { key: "hard-shadow", label: "Hard shadow" }, { key: "frosted", label: "Frosted glass" }];
export const SOCIAL_ICON_STYLES = [{ key: "default", label: "Default" }, { key: "circle", label: "Circle" }, { key: "square", label: "Square" }, { key: "colored", label: "Brand colors" }];

export const SOCIAL_NETWORKS: { key: string; label: string; color: string; prefix?: string }[] = [
  { key: "instagram", label: "Instagram", color: "#E1306C", prefix: "https://instagram.com/" }, { key: "twitter", label: "X / Twitter", color: "#000000", prefix: "https://x.com/" },
  { key: "facebook", label: "Facebook", color: "#1877F2", prefix: "https://facebook.com/" }, { key: "tiktok", label: "TikTok", color: "#000000", prefix: "https://tiktok.com/@" },
  { key: "youtube", label: "YouTube", color: "#FF0000", prefix: "https://youtube.com/@" }, { key: "linkedin", label: "LinkedIn", color: "#0A66C2", prefix: "https://linkedin.com/in/" },
  { key: "github", label: "GitHub", color: "#181717", prefix: "https://github.com/" }, { key: "whatsapp", label: "WhatsApp", color: "#25D366", prefix: "https://wa.me/" },
  { key: "viber", label: "Viber", color: "#7360F2", prefix: "viber://chat?number=" }, { key: "telegram", label: "Telegram", color: "#26A5E4", prefix: "https://t.me/" },
  { key: "spotify", label: "Spotify", color: "#1DB954", prefix: "https://open.spotify.com/" }, { key: "snapchat", label: "Snapchat", color: "#FFFC00", prefix: "https://snapchat.com/add/" },
  { key: "threads", label: "Threads", color: "#000000", prefix: "https://threads.net/@" }, { key: "pinterest", label: "Pinterest", color: "#BD081C", prefix: "https://pinterest.com/" },
  { key: "twitch", label: "Twitch", color: "#9146FF", prefix: "https://twitch.tv/" }, { key: "discord", label: "Discord", color: "#5865F2", prefix: "https://discord.gg/" },
  { key: "email", label: "Email", color: "#64748b", prefix: "mailto:" }, { key: "website", label: "Website", color: "#0ea5e9", prefix: "https://" },
];

// ------------------------------------------------------------------ Parsed page helpers
export interface ParsedBio { colors: BioColors; seo: BioSeo; socials: BioSocial[]; pixelIds: string[] }
export function parseBioJson(page: Pick<BioPage, "colors" | "seo" | "socials" | "pixelsJson">): ParsedBio {
  const socials = json<BioSocial[]>(page.socials, []);
  return {
    colors: json<BioColors>(page.colors, {}),
    seo: json<BioSeo>(page.seo, {}),
    socials: Array.isArray(socials) ? socials.filter((s) => s && s.url).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [],
    pixelIds: json<string[]>(page.pixelsJson, []),
  };
}

/** Per-block size controls (stored in block.content). Width is a % of the column, scale zooms the block. */
export const BLOCK_SIZE = {
  width: { key: "blockWidth", label: "Width", type: "range", min: 30, max: 100, step: 5, unit: "%" } as WidgetField,
  scale: { key: "blockScale", label: "Scale", type: "range", min: 50, max: 150, step: 5, unit: "%" } as WidgetField,
  align: { key: "blockAlign", label: "Alignment", type: "select", options: [{ value: "center", label: "Center" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }] } as WidgetField,
};
export function blockSize(content: Record<string, unknown>) {
  const num = (v: unknown, d: number, min: number, max: number) => { const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN; return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
  const align = content.blockAlign === "left" || content.blockAlign === "right" ? content.blockAlign : "center";
  return { width: num(content.blockWidth, 100, 30, 100), scale: num(content.blockScale, 100, 50, 150), align };
}

export function blockContent<T extends Record<string, unknown> = Record<string, unknown>>(block: Pick<BioBlock, "content">): T {
  return json<T>(block.content, {} as T);
}

/** Effective colors: theme preset merged with custom overrides (custom theme = overrides only). */
export function effectiveColors(theme: string, custom: BioColors): Required<Pick<BioColors, "bg" | "text" | "button" | "buttonText">> & BioColors {
  const preset = BIO_THEMES.find((t) => t.key === theme)?.colors ?? BIO_THEMES[0].colors;
  const merged: BioColors = theme === "custom" ? { ...BIO_THEMES[0].colors, ...custom } : { ...preset, ...Object.fromEntries(Object.entries(custom).filter(([, v]) => v !== undefined && v !== "")) };
  return { bg: merged.bg ?? "#f1f5f9", text: merged.text ?? "#0f172a", button: merged.button ?? "#0f172a", buttonText: merged.buttonText ?? "#ffffff", ...merged };
}

export interface BioVisitor { countryCode?: string | null; language?: string | null }

/** Whether a block should be shown to this visitor right now (enabled, in schedule, country/language allowed). */
export function blockVisible(block: Pick<BioBlock, "enabled" | "scheduleStart" | "scheduleEnd" | "countries" | "languages">, visitor?: BioVisitor | null, now = new Date()) {
  if (!block.enabled) return false;
  if (block.scheduleStart && new Date(block.scheduleStart) > now) return false;
  if (block.scheduleEnd && new Date(block.scheduleEnd) < now) return false;
  const countries = json<string[]>(block.countries, []).map((c) => c.toUpperCase()).filter(Boolean);
  if (countries.length && visitor?.countryCode && !countries.includes(visitor.countryCode.toUpperCase())) return false;
  const languages = json<string[]>(block.languages, []).map((l) => l.toLowerCase()).filter(Boolean);
  if (languages.length && visitor?.language && !languages.includes(visitor.language.toLowerCase().split("-")[0])) return false;
  return true;
}

// ------------------------------------------------------------------ Built-in templates
export interface BioTemplateBlock { type: string; title?: string; url?: string; thumbnail?: string; content?: Record<string, unknown> }
export interface BioTemplate { key: string; name: string; description: string; page: Partial<Pick<BioPage, "theme" | "layout" | "buttonStyle" | "font" | "socialIconStyle" | "socialsPosition" | "bio" | "colors">>; blocks: BioTemplateBlock[]; socials?: BioSocial[] }

export const BIO_TEMPLATES: BioTemplate[] = [
  { key: "creator", name: "Creator", description: "Video, socials and a newsletter for content creators", page: { theme: "candy", layout: "centered", buttonStyle: "pill", font: "Poppins", socialIconStyle: "circle", bio: "Creating videos about tech, travel and life." },
    socials: [{ network: "youtube", url: "https://youtube.com/@you" }, { network: "instagram", url: "https://instagram.com/you" }, { network: "tiktok", url: "https://tiktok.com/@you" }],
    blocks: [{ type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, { type: "link", title: "My latest video", url: "https://youtube.com" }, { type: "link", title: "Merch store", url: "https://example.com/shop" }, { type: "newsletter", title: "Join my newsletter", content: { buttonText: "Subscribe" } }, { type: "donation", title: "Buy me a coffee", content: { provider: "buymeacoffee", username: "you" } }] },
  { key: "business", name: "Business", description: "Company card with contact, booking and location", page: { theme: "light", layout: "card", buttonStyle: "shadow", font: "Inter", bio: "We help small businesses grow online." },
    socials: [{ network: "linkedin", url: "https://linkedin.com/company/you" }, { network: "facebook", url: "https://facebook.com/you" }, { network: "website", url: "https://example.com" }],
    blocks: [{ type: "heading", title: "Get in touch" }, { type: "phone", title: "Call us", content: { phone: "+15550000000" } }, { type: "email", title: "Email us", content: { email: "hello@example.com" } }, { type: "booking", title: "Book a consultation", url: "https://calendly.com/you" }, { type: "map", content: { address: "1600 Amphitheatre Parkway, Mountain View" } }, { type: "vcard", title: "Save contact", content: { firstName: "Your", lastName: "Company", org: "Your Company", email: "hello@example.com" } }, { type: "contact", title: "Send a message" }] },
  { key: "musician", name: "Musician", description: "Smart music links, tour dates and merch", page: { theme: "midnight", layout: "centered", buttonStyle: "hard-shadow", font: "Space Grotesk", bio: "New single out now." },
    socials: [{ network: "spotify", url: "https://open.spotify.com/artist/you" }, { network: "instagram", url: "https://instagram.com/you" }, { network: "youtube", url: "https://youtube.com/@you" }],
    blocks: [{ type: "music", title: "New single", content: { spotify: "https://open.spotify.com/track/xyz", apple: "https://music.apple.com/", youtube: "https://music.youtube.com/" } }, { type: "spotify", url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" }, { type: "countdown", title: "Album release", content: { date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16) } }, { type: "link", title: "Tour dates", url: "https://example.com/tour" }, { type: "link", title: "Merch", url: "https://example.com/merch" }] },
  { key: "restaurant", name: "Restaurant", description: "Menu, reservations, opening hours and reviews", page: { theme: "peach", layout: "centered", buttonStyle: "rounded", font: "Playfair Display", bio: "Fresh food, made with love. Open daily 11am - 10pm." },
    socials: [{ network: "instagram", url: "https://instagram.com/you" }, { network: "facebook", url: "https://facebook.com/you" }],
    blocks: [{ type: "featured", title: "Our menu", url: "https://example.com/menu", content: { description: "Seasonal dishes and daily specials", buttonText: "View menu" } }, { type: "opentable", title: "Reserve a table", url: "https://www.opentable.com/" }, { type: "link", title: "Order delivery", url: "https://example.com/order" }, { type: "map", content: { address: "Your restaurant address" } }, { type: "faq", title: "FAQ", content: { items: [{ q: "Do you take walk-ins?", a: "Yes, subject to availability." }, { q: "Vegan options?", a: "Absolutely, ask our staff." }] } }, { type: "phone", title: "Call to book", content: { phone: "+15550000000" } }] },
  { key: "portfolio", name: "Portfolio", description: "Showcase work with a gallery and contact form", page: { theme: "dark", layout: "grid", buttonStyle: "outline", font: "DM Sans", bio: "Designer & photographer based in Berlin." },
    socials: [{ network: "instagram", url: "https://instagram.com/you" }, { network: "linkedin", url: "https://linkedin.com/in/you" }, { network: "github", url: "https://github.com/you" }],
    blocks: [{ type: "gallery", content: { columns: "2", images: [] } }, { type: "link", title: "Case studies", url: "https://example.com/work" }, { type: "link", title: "Resume", url: "https://example.com/resume.pdf" }, { type: "github", title: "GitHub", content: { repo: "you" } }, { type: "contact", title: "Work with me" }] },
  { key: "event", name: "Event", description: "Countdown, tickets, schedule and location", page: { theme: "ocean", layout: "centered", buttonStyle: "frosted", font: "Montserrat", bio: "Join us for the biggest meetup of the year." },
    socials: [{ network: "twitter", url: "https://x.com/you" }, { network: "instagram", url: "https://instagram.com/you" }],
    blocks: [{ type: "countdown", title: "Doors open in", content: { date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16) } }, { type: "eventbrite", title: "Get tickets", url: "https://www.eventbrite.com/" }, { type: "heading", title: "Schedule" }, { type: "text", content: { text: "**10:00** Registration\n**11:00** Keynote\n**13:00** Lunch\n**14:00** Workshops" } }, { type: "map", content: { address: "Convention center" } }, { type: "newsletter", title: "Get event updates" }] },
];

/** Public URL of a bio page (custom domain > main domain). */
export function bioUrl(page: { alias: string; domain?: { domain: string } | null }, base: string) {
  if (page.domain?.domain) return `https://${page.domain.domain}/${page.alias}`;
  return `${base.replace(/\/$/, "")}/${page.alias}`;
}

/** Tiny markdown subset -> HTML (bold, italic, links, line breaks). Escapes HTML first. */
export function miniMarkdown(src: string) {
  const esc = src.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline">$1</a>')
    .replace(/\n/g, "<br/>");
}
