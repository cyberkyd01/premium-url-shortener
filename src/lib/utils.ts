import { customAlphabet } from "nanoid";
import crypto from "crypto";

export const ALIAS_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const nano = customAlphabet(ALIAS_ALPHABET, 6);

export function randomAlias(length = 6) {
  return customAlphabet(ALIAS_ALPHABET, length)();
}
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
export function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}
export function slugify(input: string) {
  return input
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
export function isValidAlias(a: string) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(a);
}
export function isValidUrl(u: string) {
  try {
    const url = new URL(u);
    return ["http:", "https:", "mailto:", "tel:", "ftp:", "sms:"].includes(url.protocol);
  } catch {
    return false;
  }
}
export function normalizeUrl(u: string) {
  const t = u.trim();
  if (!/^[a-z]+:/i.test(t)) return "https://" + t;
  return t;
}
export function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
export function json<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US", { notation: n > 9999 ? "compact" : "standard" }).format(n);
}
export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
export function appUrl(path = "") {
  const base = (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}
export function appHost() {
  try {
    return new URL(appUrl()).host;
  } catch {
    return "localhost:3000";
  }
}
export function appendParams(url: string, params: Record<string, string | undefined | null>) {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function daysAgo(n: number) {
  return startOfDay(addDays(new Date(), -n));
}
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
export function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
export function invoiceNumber() {
  return "INV-" + Date.now().toString(36).toUpperCase() + "-" + nano().toUpperCase().slice(0, 4);
}
export function generateApiKey() {
  return "pus_" + randomToken(24);
}
export { nano };
