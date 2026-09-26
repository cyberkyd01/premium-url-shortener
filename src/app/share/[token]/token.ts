import { sha256 } from "@/lib/utils";

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "premium-url-shortener";
}

/** Cookie name + signed value proving the viewer entered the report's password. */
export function shareCookieName(reportId: string) { return `share_${reportId}`; }
export function shareCookieValue(reportId: string, passwordHash: string) { return sha256(`share:${reportId}:${passwordHash}:${secret()}`); }
