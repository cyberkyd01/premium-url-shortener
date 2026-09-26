"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { verifyCaptcha, captchaClientConfig } from "@/lib/captcha";
import { clientIp } from "@/lib/geo";
import { pwCookieName, pwToken } from "@/lib/link-cookies";
import type { ActionState } from "@/components/ui/form-state";

async function captchaOk(fd: FormData) {
  const cfg = await captchaClientConfig();
  if (!cfg.on.password || cfg.provider === "none") return true;
  const token = String(fd.get("captcha") || fd.get("g-recaptcha-response") || fd.get("h-captcha-response") || fd.get("cf-turnstile-response") || "");
  return verifyCaptcha(token, clientIp(await headers()));
}

async function matches(input: string, stored: string) {
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(input, stored);
  return input === stored;
}

async function setPwCookie(kind: "link" | "file", id: string) {
  (await cookies()).set(pwCookieName(kind, id), pwToken(kind, id), { maxAge: 3600, httpOnly: true, sameSite: "lax", path: "/" });
}

/** Verifies a password-protected link and stores an hour-long unlock cookie. */
export async function unlockLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!(await captchaOk(fd))) return { error: "Captcha verification failed" };
  const link = await db.link.findUnique({ where: { id }, select: { password: true } });
  if (!link?.password) return { error: "Link not found" };
  if (!password || !(await matches(password, link.password))) return { error: "Incorrect password" };
  await setPwCookie("link", id);
  return { ok: true, message: "Unlocked. Redirecting…" };
}

/** Verifies a hosted file password. */
export async function unlockFile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!(await captchaOk(fd))) return { error: "Captcha verification failed" };
  const file = await db.hostedFile.findUnique({ where: { id }, select: { password: true } });
  if (!file?.password) return { error: "File not found" };
  if (!password || !(await matches(password, file.password))) return { error: "Incorrect password" };
  await setPwCookie("file", id);
  return { ok: true, message: "Unlocked." };
}

/** Counts a download and sends the visitor to the stored file. */
export async function downloadFile(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "");
  const file = await db.hostedFile.findUnique({ where: { id } });
  if (!file) redirect("/");
  if (file.expiresAt && file.expiresAt < new Date()) redirect(`/${file.alias}`);
  if (file.password) {
    const c = (await cookies()).get(pwCookieName("file", id))?.value;
    if (c !== pwToken("file", id)) redirect(`/${file.alias}`);
  }
  await db.hostedFile.update({ where: { id }, data: { downloads: { increment: 1 } } });
  redirect(fileUrl(file.path));
}

function fileUrl(p: string) {
  if (/^https?:\/\//.test(p) || p.startsWith("/")) return p;
  return `/uploads/${p.replace(/^uploads\//, "")}`;
}
