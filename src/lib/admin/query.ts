/** Helpers for list pages: search params, pagination, form parsing. */
export type SP = Record<string, string | string[] | undefined>;

export function qs(sp: SP, key: string, fallback = ""): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return (v ?? fallback).toString();
}

export function paging(sp: SP, perPage = 25) {
  const page = Math.max(1, parseInt(qs(sp, "page", "1"), 10) || 1);
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function pagesOf(total: number, perPage: number) {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Builds an href generator that keeps the current filters and swaps the page number. */
export function pageHref(base: string, sp: SP) {
  return (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") u.set(k, v);
    if (p > 1) u.set("page", String(p));
    const q = u.toString();
    return q ? `${base}?${q}` : base;
  };
}

export function str(fd: FormData, key: string, max = 5000): string {
  const v = fd.get(key);
  return (typeof v === "string" ? v : "").trim().slice(0, max);
}
export function optStr(fd: FormData, key: string, max = 5000): string | null {
  const v = str(fd, key, max);
  return v ? v : null;
}
export function num(fd: FormData, key: string, fallback = 0): number {
  const v = parseFloat(str(fd, key));
  return Number.isFinite(v) ? v : fallback;
}
export function int(fd: FormData, key: string, fallback = 0): number {
  const v = parseInt(str(fd, key), 10);
  return Number.isFinite(v) ? v : fallback;
}
export function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key);
  return v === "1" || v === "true" || v === "on";
}
export function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
export function list(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => (typeof v === "string" ? v : "")).filter(Boolean);
}
export function ids(fd: FormData): string[] {
  return list(fd, "ids");
}
export function toDateInput(d: Date | null | undefined) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}
export function toDateTimeInput(d: Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
