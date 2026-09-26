/** Shared (server-safe) overlay constants and types. */
export const OVERLAY_TYPES = [
  { key: "message", label: "Message", description: "Title, message and an optional button" },
  { key: "contact", label: "Contact form", description: "Name, email and message form" },
  { key: "poll", label: "Poll", description: "Question with selectable options" },
  { key: "newsletter", label: "Newsletter", description: "Email capture form" },
  { key: "image", label: "Image", description: "Image linking to a URL" },
  { key: "video", label: "Video", description: "YouTube, Vimeo or MP4 embed" },
  { key: "cta", label: "Call to action", description: "Headline with a prominent button" },
  { key: "coupon", label: "Coupon", description: "Coupon code with copy button and link" },
] as const;
export type OverlayType = (typeof OVERLAY_TYPES)[number]["key"];

export const OVERLAY_POSITIONS = [
  { key: "bottom-left", label: "Bottom left" }, { key: "bottom-right", label: "Bottom right" }, { key: "top", label: "Top bar" }, { key: "center", label: "Center (modal)" }, { key: "bottom-bar", label: "Bottom bar" },
] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number]["key"];

export function overlayTypeLabel(key: string) {
  return OVERLAY_TYPES.find((t) => t.key === key)?.label ?? key;
}
export function overlayPositionLabel(key: string) {
  return OVERLAY_POSITIONS.find((p) => p.key === key)?.label ?? key;
}

/** JSON stored in Overlay.options */
export interface OverlayOptions {
  pollOptions?: string[];
  couponCode?: string;
  formFields?: ("name" | "email" | "message")[];
  successMessage?: string;
  buttonNewTab?: boolean;
  showClose?: boolean;
}

/** Subset of the Prisma Overlay model needed to render the widget. `options` may be the raw JSON string or a parsed object. */
export interface OverlayData {
  id: string;
  type: string;
  position: string;
  title?: string | null;
  message?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  image?: string | null;
  video?: string | null;
  options?: string | OverlayOptions | null;
  bgColor?: string | null;
  textColor?: string | null;
  accentColor?: string | null;
  delay?: number | null;
  disclaimer?: string | null;
}

export function parseOverlayOptions(o: OverlayData["options"]): OverlayOptions {
  if (!o) return {};
  if (typeof o === "object") return o;
  try { return JSON.parse(o) as OverlayOptions; } catch { return {}; }
}
