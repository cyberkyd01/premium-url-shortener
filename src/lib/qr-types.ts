/** Pure (isomorphic) QR helpers: types, per-type form fields, data encoders and style presets.
 *  Server-only rendering lives in `./qr.ts`. */

export type QrType = "url" | "text" | "email" | "phone" | "sms" | "wifi" | "vcard" | "location" | "event" | "app" | "crypto" | "whatsapp" | "paypal" | "link" | "bio";

export type QrDotType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type QrCornerSquareType = "square" | "extra-rounded" | "dot";
export type QrCornerDotType = "square" | "dot";
export type QrFrameType = "none" | "simple" | "label-bottom" | "label-top" | "badge";

export interface QrGradient { type: "linear" | "radial"; rotation: number; from: string; to: string }

export interface QrStyle {
  dots: QrDotType;
  corners: QrCornerSquareType;
  cornerDots: QrCornerDotType;
  color: string;
  gradient: QrGradient | null;
  bg: string; // hex or "transparent"
  logo: string | null;
  logoSize: number; // fraction of QR width 0.15 - 0.4
  frame: QrFrameType;
  frameText: string;
  frameColor: string;
  margin: number; // modules
  size: number; // px
  ecLevel: "L" | "M" | "Q" | "H";
  template: string;
}

export const DEFAULT_QR_STYLE: QrStyle = {
  dots: "square", corners: "square", cornerDots: "square", color: "#000000", gradient: null, bg: "#ffffff",
  logo: null, logoSize: 0.25, frame: "none", frameText: "Scan me", frameColor: "#000000", margin: 2, size: 300, ecLevel: "M", template: "classic",
};

const DOT_TYPES: QrDotType[] = ["square", "rounded", "dots", "classy", "classy-rounded", "extra-rounded"];
const CORNER_TYPES: QrCornerSquareType[] = ["square", "extra-rounded", "dot"];
const CORNER_DOT_TYPES: QrCornerDotType[] = ["square", "dot"];
const FRAME_TYPES: QrFrameType[] = ["none", "simple", "label-bottom", "label-top", "badge"];
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v);

/** Coerces unknown JSON into a valid QrStyle (used by the render API and the DB style column). */
export function normalizeQrStyle(input: unknown): QrStyle {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const s: QrStyle = { ...DEFAULT_QR_STYLE };
  if (DOT_TYPES.includes(o.dots as QrDotType)) s.dots = o.dots as QrDotType;
  if (CORNER_TYPES.includes(o.corners as QrCornerSquareType)) s.corners = o.corners as QrCornerSquareType;
  if (CORNER_DOT_TYPES.includes(o.cornerDots as QrCornerDotType)) s.cornerDots = o.cornerDots as QrCornerDotType;
  if (isHex(o.color)) s.color = o.color;
  if (isHex(o.bg) || o.bg === "transparent") s.bg = o.bg as string;
  if (o.gradient && typeof o.gradient === "object") {
    const g = o.gradient as Record<string, unknown>;
    if (isHex(g.from) && isHex(g.to)) s.gradient = { type: g.type === "radial" ? "radial" : "linear", rotation: typeof g.rotation === "number" ? g.rotation : 0, from: g.from, to: g.to };
  }
  if (typeof o.logo === "string" && /^(https?:\/\/|\/|data:image\/)/.test(o.logo)) s.logo = o.logo.slice(0, 200000);
  if (typeof o.logoSize === "number") s.logoSize = Math.min(0.4, Math.max(0.1, o.logoSize));
  if (FRAME_TYPES.includes(o.frame as QrFrameType)) s.frame = o.frame as QrFrameType;
  if (typeof o.frameText === "string") s.frameText = o.frameText.slice(0, 40);
  if (isHex(o.frameColor)) s.frameColor = o.frameColor;
  if (typeof o.margin === "number") s.margin = Math.min(10, Math.max(0, Math.round(o.margin)));
  if (typeof o.size === "number") s.size = Math.min(2000, Math.max(64, Math.round(o.size)));
  if (["L", "M", "Q", "H"].includes(o.ecLevel as string)) s.ecLevel = o.ecLevel as QrStyle["ecLevel"];
  if (typeof o.template === "string") s.template = o.template.slice(0, 40);
  return s;
}

export function encodeQrStyle(style: Partial<QrStyle>): string {
  const str = JSON.stringify(style);
  if (typeof window !== "undefined" && typeof window.btoa === "function") return window.btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, "utf8").toString("base64");
}
export function decodeQrStyle(b64: string | null | undefined): QrStyle {
  if (!b64) return { ...DEFAULT_QR_STYLE };
  try {
    const str = typeof window !== "undefined" && typeof window.atob === "function" ? decodeURIComponent(escape(window.atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
    return normalizeQrStyle(JSON.parse(str));
  } catch { return { ...DEFAULT_QR_STYLE }; }
}

// ------------------------------------------------------------------ Types & fields
export interface QrField { key: string; label: string; type?: "text" | "url" | "textarea" | "email" | "tel" | "number" | "select" | "datetime" | "upload"; placeholder?: string; options?: { value: string; label: string }[]; hint?: string; required?: boolean }

export const QR_TYPES: { type: QrType; label: string; description: string; dynamic: boolean }[] = [
  { type: "url", label: "URL", description: "Open a website", dynamic: true },
  { type: "link", label: "Short link", description: "Use one of your existing short links", dynamic: true },
  { type: "bio", label: "Bio page", description: "Open one of your bio pages", dynamic: true },
  { type: "text", label: "Text", description: "Plain text message", dynamic: false },
  { type: "email", label: "Email", description: "Compose an email", dynamic: false },
  { type: "phone", label: "Phone", description: "Dial a phone number", dynamic: false },
  { type: "sms", label: "SMS", description: "Send a text message", dynamic: false },
  { type: "wifi", label: "Wi-Fi", description: "Join a wireless network", dynamic: false },
  { type: "vcard", label: "vCard", description: "Save a contact card", dynamic: false },
  { type: "location", label: "Location", description: "Open a map location", dynamic: false },
  { type: "event", label: "Event", description: "Add a calendar event", dynamic: false },
  { type: "app", label: "App", description: "Redirect to App Store / Play Store by device", dynamic: true },
  { type: "crypto", label: "Crypto", description: "Cryptocurrency payment", dynamic: false },
  { type: "whatsapp", label: "WhatsApp", description: "Start a WhatsApp chat", dynamic: true },
  { type: "paypal", label: "PayPal", description: "PayPal.me payment link", dynamic: true },
];

export const QR_TYPE_FIELDS: Record<QrType, QrField[]> = {
  url: [{ key: "url", label: "Website URL", type: "url", placeholder: "https://example.com", required: true }],
  link: [{ key: "url", label: "Short link URL", type: "url", placeholder: "https://…", required: true }],
  bio: [{ key: "url", label: "Bio page URL", type: "url", placeholder: "https://…", required: true }],
  text: [{ key: "text", label: "Text", type: "textarea", placeholder: "Your message", required: true }],
  email: [
    { key: "email", label: "Email address", type: "email", placeholder: "hello@example.com", required: true },
    { key: "subject", label: "Subject", placeholder: "Subject" },
    { key: "body", label: "Message", type: "textarea", placeholder: "Message body" },
  ],
  phone: [{ key: "phone", label: "Phone number", type: "tel", placeholder: "+1 555 000 0000", required: true }],
  sms: [{ key: "phone", label: "Phone number", type: "tel", placeholder: "+1 555 000 0000", required: true }, { key: "message", label: "Message", type: "textarea" }],
  wifi: [
    { key: "ssid", label: "Network name (SSID)", required: true },
    { key: "password", label: "Password" },
    { key: "encryption", label: "Encryption", type: "select", options: [{ value: "WPA", label: "WPA/WPA2" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "None" }] },
    { key: "hidden", label: "Hidden network", type: "select", options: [{ value: "", label: "No" }, { value: "true", label: "Yes" }] },
  ],
  vcard: [
    { key: "firstName", label: "First name", required: true }, { key: "lastName", label: "Last name" },
    { key: "org", label: "Company" }, { key: "title", label: "Job title" },
    { key: "phone", label: "Phone", type: "tel" }, { key: "mobile", label: "Mobile", type: "tel" },
    { key: "email", label: "Email", type: "email" }, { key: "website", label: "Website", type: "url" },
    { key: "street", label: "Street" }, { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "zip", label: "ZIP" }, { key: "country", label: "Country" },
    { key: "photo", label: "Photo", type: "upload", hint: "Photo URL embedded in the vCard" }, { key: "note", label: "Note", type: "textarea" },
  ],
  location: [{ key: "lat", label: "Latitude", type: "number", placeholder: "40.7128", required: true }, { key: "lng", label: "Longitude", type: "number", placeholder: "-74.0060", required: true }],
  event: [
    { key: "title", label: "Event title", required: true }, { key: "location", label: "Location" },
    { key: "start", label: "Start", type: "datetime", required: true }, { key: "end", label: "End", type: "datetime" },
    { key: "description", label: "Description", type: "textarea" }, { key: "url", label: "URL", type: "url" },
  ],
  app: [
    { key: "ios", label: "App Store URL", type: "url", placeholder: "https://apps.apple.com/…" },
    { key: "android", label: "Play Store URL", type: "url", placeholder: "https://play.google.com/…" },
    { key: "fallback", label: "Fallback URL (desktop / other)", type: "url", required: true },
  ],
  crypto: [
    { key: "coin", label: "Coin", type: "select", options: [{ value: "bitcoin", label: "Bitcoin" }, { value: "ethereum", label: "Ethereum" }, { value: "litecoin", label: "Litecoin" }, { value: "bitcoincash", label: "Bitcoin Cash" }, { value: "dogecoin", label: "Dogecoin" }] },
    { key: "address", label: "Wallet address", required: true }, { key: "amount", label: "Amount", type: "number" }, { key: "label", label: "Label" },
  ],
  whatsapp: [{ key: "phone", label: "Phone number (international)", type: "tel", placeholder: "15550000000", required: true }, { key: "message", label: "Prefilled message", type: "textarea" }],
  paypal: [{ key: "username", label: "PayPal.me username", required: true }, { key: "amount", label: "Amount", type: "number" }, { key: "currency", label: "Currency", placeholder: "USD" }],
};

const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
const icsDate = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toISOString().replace(/[-:]|\.\d{3}/g, ""); };
const icsEsc = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);

/** Turns structured per-type fields into the raw string a QR code encodes. */
export function encodeQrData(type: string, data: Record<string, string>): string {
  const g = (k: string) => (data[k] ?? "").trim();
  switch (type as QrType) {
    case "url": case "link": case "bio": return g("url");
    case "text": return g("text");
    case "email": {
      const p = new URLSearchParams();
      if (g("subject")) p.set("subject", g("subject"));
      if (g("body")) p.set("body", g("body"));
      const q = p.toString().replace(/\+/g, "%20");
      return `mailto:${g("email")}${q ? "?" + q : ""}`;
    }
    case "phone": return `tel:${g("phone").replace(/[^+\d]/g, "")}`;
    case "sms": return `SMSTO:${g("phone").replace(/[^+\d]/g, "")}:${g("message")}`;
    case "wifi": {
      const enc = g("encryption") || "WPA";
      return `WIFI:T:${enc === "nopass" ? "nopass" : enc};S:${esc(g("ssid"))};P:${esc(g("password"))};${g("hidden") ? "H:true;" : ""};`;
    }
    case "vcard": {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(g("lastName"))};${esc(g("firstName"))};;;`, `FN:${esc([g("firstName"), g("lastName")].filter(Boolean).join(" "))}`];
      if (g("org")) lines.push(`ORG:${esc(g("org"))}`);
      if (g("title")) lines.push(`TITLE:${esc(g("title"))}`);
      if (g("phone")) lines.push(`TEL;TYPE=WORK,VOICE:${g("phone")}`);
      if (g("mobile")) lines.push(`TEL;TYPE=CELL:${g("mobile")}`);
      if (g("email")) lines.push(`EMAIL;TYPE=INTERNET:${g("email")}`);
      if (g("website")) lines.push(`URL:${g("website")}`);
      if (g("street") || g("city") || g("country")) lines.push(`ADR;TYPE=WORK:;;${esc(g("street"))};${esc(g("city"))};${esc(g("state"))};${esc(g("zip"))};${esc(g("country"))}`);
      if (g("photo")) lines.push(`PHOTO;VALUE=URI:${g("photo")}`);
      if (g("note")) lines.push(`NOTE:${esc(g("note"))}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
    case "location": return `geo:${g("lat")},${g("lng")}`;
    case "event": {
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${icsEsc(g("title"))}`];
      if (g("start")) lines.push(`DTSTART:${icsDate(g("start"))}`);
      if (g("end")) lines.push(`DTEND:${icsDate(g("end"))}`);
      if (g("location")) lines.push(`LOCATION:${icsEsc(g("location"))}`);
      if (g("description")) lines.push(`DESCRIPTION:${icsEsc(g("description"))}`);
      if (g("url")) lines.push(`URL:${g("url")}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    }
    case "app": return g("url") || g("fallback") || g("ios") || g("android");
    case "crypto": {
      const p = new URLSearchParams();
      if (g("amount")) p.set("amount", g("amount"));
      if (g("label")) p.set("label", g("label"));
      const q = p.toString();
      return `${g("coin") || "bitcoin"}:${g("address")}${q ? "?" + q : ""}`;
    }
    case "whatsapp": return `https://wa.me/${g("phone").replace(/[^\d]/g, "")}${g("message") ? "?text=" + encodeURIComponent(g("message")) : ""}`;
    case "paypal": return `https://paypal.me/${g("username").replace(/^@/, "")}${g("amount") ? "/" + g("amount") + (g("currency") ? g("currency").toUpperCase() : "") : ""}`;
    default: return g("url") || g("text") || "";
  }
}

export function isDynamicCapable(type: string) {
  return QR_TYPES.find((t) => t.type === type)?.dynamic ?? false;
}

// ------------------------------------------------------------------ Style templates
export const QR_STYLE_TEMPLATES: { key: string; label: string; style: Partial<QrStyle> }[] = [
  { key: "classic", label: "Classic", style: { dots: "square", corners: "square", cornerDots: "square", color: "#000000", gradient: null, bg: "#ffffff", frame: "none" } },
  { key: "rounded", label: "Rounded", style: { dots: "rounded", corners: "extra-rounded", cornerDots: "dot", color: "#111827", gradient: null, bg: "#ffffff", frame: "none" } },
  { key: "dots", label: "Dots", style: { dots: "dots", corners: "dot", cornerDots: "dot", color: "#4f46e5", gradient: null, bg: "#ffffff", frame: "none" } },
  { key: "sunset", label: "Sunset", style: { dots: "classy-rounded", corners: "extra-rounded", cornerDots: "dot", color: "#f97316", gradient: { type: "linear", rotation: 45, from: "#f43f5e", to: "#f59e0b" }, bg: "#ffffff", frame: "none" } },
  { key: "ocean", label: "Ocean", style: { dots: "extra-rounded", corners: "extra-rounded", cornerDots: "square", color: "#0ea5e9", gradient: { type: "radial", rotation: 0, from: "#0ea5e9", to: "#1e3a8a" }, bg: "#ffffff", frame: "none" } },
  { key: "dark", label: "Dark mode", style: { dots: "rounded", corners: "extra-rounded", cornerDots: "dot", color: "#ffffff", gradient: null, bg: "#0f172a", frame: "none" } },
  { key: "scan-me", label: "Scan me", style: { dots: "square", corners: "square", cornerDots: "square", color: "#000000", gradient: null, bg: "#ffffff", frame: "label-bottom", frameText: "SCAN ME", frameColor: "#000000" } },
  { key: "badge", label: "Badge", style: { dots: "classy", corners: "extra-rounded", cornerDots: "dot", color: "#7c3aed", gradient: null, bg: "#ffffff", frame: "badge", frameText: "Scan to open", frameColor: "#7c3aed" } },
];

/** qr-code-styling options object for the client-side live preview (identical shapes as the server renderer). */
export function qrStylingOptions(data: string, s: QrStyle) {
  const gradient = s.gradient ? { type: s.gradient.type, rotation: (s.gradient.rotation * Math.PI) / 180, colorStops: [{ offset: 0, color: s.gradient.from }, { offset: 1, color: s.gradient.to }] } : undefined;
  return {
    width: s.size, height: s.size, type: "svg" as const, data: data || " ", margin: s.margin * 4, image: s.logo ?? undefined,
    qrOptions: { errorCorrectionLevel: s.logo ? "H" as const : s.ecLevel },
    imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: s.logoSize, hideBackgroundDots: true },
    dotsOptions: { type: s.dots, color: s.color, gradient },
    cornersSquareOptions: { type: s.corners, color: s.color, gradient },
    cornersDotOptions: { type: s.cornerDots, color: s.color, gradient },
    backgroundOptions: { color: s.bg === "transparent" ? "rgba(0,0,0,0)" : s.bg },
  };
}
