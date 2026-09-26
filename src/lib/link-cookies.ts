import { sha256 } from "./utils";

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "premium-url-shortener";
}

/** Signed value stored in the password cookie so it cannot be forged. */
export function pwToken(kind: "link" | "file", id: string) {
  return sha256(`pw:${kind}:${id}:${secret()}`);
}
export function pwCookieName(kind: "link" | "file", id: string) {
  return kind === "link" ? `pw_${id}` : `fpw_${id}`;
}
export function rotatorCookieName(campaignId: string) {
  return `rot_${campaignId}`;
}
