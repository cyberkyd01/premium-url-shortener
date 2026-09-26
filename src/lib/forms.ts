/** Small FormData helpers shared by dashboard server actions. */
export function str(fd: FormData, key: string, max = 500): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export function strOrNull(fd: FormData, key: string, max = 500): string | null {
  const v = str(fd, key, max);
  return v ? v : null;
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "1" || v === "on" || v === "true";
}
export function int(fd: FormData, key: string, fallback = 0, min?: number, max?: number): number {
  const n = parseInt(str(fd, key, 20), 10);
  if (isNaN(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}
export function list(fd: FormData, key: string, max = 200): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim().slice(0, max));
}
export function isHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}
export function color(fd: FormData, key: string, fallback: string): string {
  const v = str(fd, key, 7);
  return isHexColor(v) ? v.toLowerCase() : fallback;
}
export function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
/** Accepts absolute http(s) URLs or site-relative upload paths (e.g. /uploads/x.png). */
export function isImageRef(v: string) {
  return v.startsWith("/") || isHttpUrl(v);
}
export function errorMessage(e: unknown, fallback = "Something went wrong") {
  return e instanceof Error && e.message ? e.message : fallback;
}
