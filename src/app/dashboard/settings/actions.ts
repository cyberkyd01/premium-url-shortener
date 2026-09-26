"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { currentUser, hashPassword, requireUser } from "@/lib/auth";
import { getSettings, getSetting } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { notifyAdmins } from "@/lib/notify";
import { storeFile } from "@/lib/storage";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { appUrl, generateApiKey, randomToken, isValidUrl } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";
import { API_PERMISSIONS } from "@/components/account/api-permissions";

const P = "/dashboard/settings";
const REPORT_FREQUENCIES = ["none", "weekly", "monthly"];
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isUsername = (v: string) => /^[a-z0-9_.-]{3,32}$/i.test(v);

// ---------------------------------------------------------------- Profile
export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const s = await getSettings();
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const username = String(fd.get("username") ?? "").trim().toLowerCase();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const timezone = String(fd.get("timezone") ?? "UTC").trim() || "UTC";
  const language = String(fd.get("language") ?? "en").trim() || "en";
  const postLoginRedirect = String(fd.get("postLoginRedirect") ?? "").trim();
  const gravatar = fd.get("gravatar") === "1";
  const notifyEmail = fd.get("notifyEmail") === "1";
  const isPublic = fd.get("isPublic") === "1";
  const removeAvatar = fd.get("removeAvatar") === "1";
  const reportFrequencyRaw = String(fd.get("reportFrequency") ?? me.reportFrequency);
  const reportFrequency = REPORT_FREQUENCIES.includes(reportFrequencyRaw) ? reportFrequencyRaw : me.reportFrequency;
  if (!isUsername(username)) return { error: "Username must be 3-32 characters (letters, numbers, . _ -)" };
  if (!isEmail(email)) return { error: "Please enter a valid email address" };
  if (postLoginRedirect && !postLoginRedirect.startsWith("/") && !isValidUrl(postLoginRedirect)) return { error: "Redirect URL must be a path or a full URL" };
  const reserved = (s["links.reservedAliases"] || "").split(",").map((x) => x.trim().toLowerCase());
  if (username !== me.username && reserved.includes(username)) return { error: "This username is reserved" };
  if (username !== me.username && (await db.user.findUnique({ where: { username } }))) return { error: "This username is already taken" };
  if (email !== me.email && (await db.user.findUnique({ where: { email } }))) return { error: "This email is already in use" };
  const lang = await db.language.findFirst({ where: { code: language, active: true } });

  let avatar: string | null | undefined = removeAvatar ? null : undefined;
  const file = fd.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { error: "Avatar must be an image" };
    try { avatar = (await storeFile(file, "avatars")).url; } catch (e) { return { error: e instanceof Error ? e.message : "Upload failed" }; }
  }
  const data: Record<string, unknown> = { name: name || null, username, timezone, language: lang ? language : me.language, postLoginRedirect: postLoginRedirect || null, gravatar, notifyEmail, isPublic: s["users.publicAccounts"] === "1" ? isPublic : me.isPublic, reportFrequency };
  if (avatar !== undefined) data.avatar = avatar;
  let message = "Profile saved";
  if (email !== me.email) {
    data.email = email;
    if (s["users.emailVerification"] === "1") {
      const token = randomToken(24);
      data.emailVerified = null; data.verificationToken = token; data.status = me.status === 0 ? 0 : 2;
      await sendTemplate("verify-email", email, { name: name || me.username, link: appUrl("/verify/" + token) }, language);
      message = "Profile saved. Please verify your new email address: we sent you a confirmation link.";
    }
  }
  await db.user.update({ where: { id: u.id }, data });
  revalidatePath("/dashboard");
  return { ok: true, message };
}

export async function resendVerification(): Promise<ActionState> {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  if (me.emailVerified && me.status !== 2) return { message: "Your email is already verified" };
  const token = me.verificationToken ?? randomToken(24);
  await db.user.update({ where: { id: me.id }, data: { verificationToken: token } });
  await sendTemplate("verify-email", me.email, { name: me.name ?? me.username, link: appUrl("/verify/" + token) }, me.language);
  return { ok: true, message: "Verification email sent to " + me.email };
}

// ---------------------------------------------------------------- Security
export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const min = parseInt(await getSetting("security.passwordMinLength"), 10) || 8;
  if (me.password && !(await bcrypt.compare(current, me.password))) return { error: "Current password is incorrect" };
  if (next.length < min) return { error: `Password must be at least ${min} characters` };
  if (next !== confirm) return { error: "Passwords do not match" };
  await db.user.update({ where: { id: u.id }, data: { password: await hashPassword(next) } });
  return { ok: true, message: "Password updated" };
}

export async function beginTwoFactor(): Promise<ActionState> {
  const u = await requireUser();
  if ((await getSetting("users.twoFactor")) !== "1") return { error: "Two-factor authentication is disabled" };
  const s = await getSettings();
  const secret = authenticator.generateSecret();
  await db.user.update({ where: { id: u.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  const otpauth = authenticator.keyuri(u.email || u.username, s["site.name"], secret);
  return { ok: true, data: { secret, otpauth } };
}

export async function enableTwoFactor(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me?.twoFactorSecret) return { error: "Start the setup first" };
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  if (!authenticator.check(code, me.twoFactorSecret)) return { error: "Invalid code. Make sure your device clock is accurate." };
  await db.user.update({ where: { id: u.id }, data: { twoFactorEnabled: true, twoFactorMethod: "app" } });
  revalidatePath(P);
  return { ok: true, message: "Two-factor authentication (authenticator app) enabled" };
}

export async function enableEmailTwoFactor(): Promise<ActionState> {
  const u = await requireUser();
  const s = await getSettings();
  if (s["users.twoFactor"] !== "1" || s["users.emailTwoFactor"] !== "1") return { error: "Email two-factor authentication is disabled" };
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me?.emailVerified) return { error: "Verify your email address first" };
  await db.user.update({ where: { id: u.id }, data: { twoFactorEnabled: true, twoFactorMethod: "email" } });
  revalidatePath(P);
  return { ok: true, message: "Email two-factor authentication enabled" };
}

export async function disableTwoFactor(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  const password = String(fd.get("password") ?? "");
  if (me.password && !(await bcrypt.compare(password, me.password))) return { error: "Password is incorrect" };
  await db.user.update({ where: { id: u.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, emailOtp: null, emailOtpExpires: null, backupCodes: "[]" } });
  revalidatePath(P);
  return { ok: true, message: "Two-factor authentication disabled" };
}

export async function requestTwoFactorReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const message = String(fd.get("message") ?? "").trim().slice(0, 1000);
  const open = await db.verificationRequest.findFirst({ where: { userId: u.id, type: "2fa_reset", status: "pending" } });
  if (open) return { error: "You already have a pending 2FA reset request" };
  await db.verificationRequest.create({ data: { userId: u.id, type: "2fa_reset", message: message || null } });
  await notifyAdmins("2FA reset request", `${u.username} requested a two-factor reset.`, "/admin/verification");
  revalidatePath(P);
  return { ok: true, message: "Request submitted. An administrator will review it." };
}

export async function disconnectAccount(fd: FormData) {
  const u = await requireUser();
  const id = String(fd.get("id") ?? "");
  const me = await db.user.findUnique({ where: { id: u.id }, select: { password: true, accounts: { select: { id: true } } } });
  if (!me) return;
  if (!me.password && me.accounts.length <= 1) return; // would lock the user out
  await db.account.deleteMany({ where: { id, userId: u.id } });
  revalidatePath(P);
}

// ---------------------------------------------------------------- 2FA backup codes
const BACKUP_CODE_COUNT = 10;

function newBackupCode() {
  // 8 chars from a confusion-free alphabet, shown as xxxx-xxxx; stored lowercase without the dash.
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

/** Generates (or replaces) 10 one-time backup codes. Returns `data: { codes: string[] }` — the plain codes are shown once. */
export async function generateBackupCodes(): Promise<ActionState> {
  const u = await requireUser();
  const me = await db.user.findUnique({ where: { id: u.id }, select: { twoFactorEnabled: true } });
  if (!me?.twoFactorEnabled) return { error: "Enable two-factor authentication first" };
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, newBackupCode);
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 8)));
  await db.user.update({ where: { id: u.id }, data: { backupCodes: JSON.stringify(hashes) } });
  revalidatePath(P);
  return { ok: true, message: "Backup codes generated. Store them somewhere safe: they are shown only once.", data: { codes: codes.map((c) => `${c.slice(0, 4)}-${c.slice(4)}`) } };
}

// ---------------------------------------------------------------- Sessions / login history
export async function clearLoginHistory(): Promise<ActionState> {
  const u = await requireUser();
  await db.loginHistory.deleteMany({ where: { userId: u.id } });
  revalidatePath(P);
  return { ok: true, message: "Login history cleared" };
}

// ---------------------------------------------------------------- API
export async function regenerateApiKey(): Promise<ActionState> {
  const u = await requireUser();
  const key = generateApiKey();
  await db.user.update({ where: { id: u.id }, data: { apiKey: key } });
  revalidatePath(P);
  return { ok: true, message: "API key regenerated" };
}

function parsePermissions(fd: FormData, isAdmin: boolean) {
  const all = fd.getAll("permissions").map(String);
  const valid = API_PERMISSIONS.filter((p) => !p.adminOnly || isAdmin).map((p) => p.key);
  const list = all.filter((p) => valid.includes(p));
  return list.length ? list : valid.filter((k) => !k.startsWith("users."));
}

export async function createApiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const { features } = await getUserPlan(u.id);
  if (u.role !== "admin" && !features.api) return { error: "Your plan does not include API access" };
  const lim = await withinLimit(u.id, "limitApiKeys");
  if (!lim.ok) return { error: `You have reached your plan limit of ${lim.limit} API keys` };
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Name is required" };
  const expires = String(fd.get("expiresAt") ?? "");
  const key = generateApiKey();
  await db.apiKey.create({ data: { userId: u.id, name, key, permissions: JSON.stringify(parsePermissions(fd, u.role === "admin")), expiresAt: expires ? new Date(expires) : null } });
  revalidatePath(P);
  return { ok: true, message: `API key created. Copy it now: ${key}`, data: { key } };
}

export async function updateApiKey(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = String(fd.get("id") ?? "");
  const k = await db.apiKey.findFirst({ where: { id, userId: u.id } });
  if (!k) return { error: "API key not found" };
  const name = String(fd.get("name") ?? "").trim().slice(0, 60) || k.name;
  const expires = String(fd.get("expiresAt") ?? "");
  await db.apiKey.update({ where: { id }, data: { name, permissions: JSON.stringify(parsePermissions(fd, u.role === "admin")), expiresAt: expires ? new Date(expires) : null, active: fd.get("active") === "1" } });
  revalidatePath(P);
  return { ok: true, message: "API key updated" };
}

export async function toggleApiKey(fd: FormData) {
  const u = await requireUser();
  const id = String(fd.get("id") ?? "");
  const k = await db.apiKey.findFirst({ where: { id, userId: u.id } });
  if (!k) return;
  await db.apiKey.update({ where: { id }, data: { active: !k.active } });
  revalidatePath(P);
}

export async function deleteApiKey(fd: FormData) {
  const u = await requireUser();
  await db.apiKey.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: u.id } });
  revalidatePath(P);
}

// ---------------------------------------------------------------- Verification badge
export async function submitVerification(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if ((await getSetting("users.verificationSystem")) !== "1") return { error: "Verification is disabled" };
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  if (me.verified) return { error: "Your account is already verified" };
  const pending = await db.verificationRequest.findFirst({ where: { userId: u.id, type: "badge", status: "pending" } });
  if (pending) return { error: "You already have a pending verification request" };
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000);
  if (message.length < 10) return { error: "Please describe why you should be verified (at least 10 characters)" };
  let document: string | null = null;
  const file = fd.get("document");
  if (file instanceof File && file.size > 0) {
    try { document = (await storeFile(file, "verification")).url; } catch (e) { return { error: e instanceof Error ? e.message : "Upload failed" }; }
  }
  await db.verificationRequest.create({ data: { userId: u.id, type: "badge", message, document } });
  await notifyAdmins("Verification request", `${u.username} requested a verified badge.`, "/admin/verification");
  revalidatePath(P);
  return { ok: true, message: "Verification request submitted" };
}

// ---------------------------------------------------------------- Danger zone
export async function deleteAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if ((await getSetting("users.deleteAccount")) !== "1") return { error: "Account deletion is disabled. Contact support." };
  const me = await db.user.findUnique({ where: { id: u.id } });
  if (!me) return { error: "User not found" };
  if (me.role === "admin") return { error: "Admin accounts cannot be deleted from here" };
  const password = String(fd.get("password") ?? "");
  if (me.password && !(await bcrypt.compare(password, me.password))) return { error: "Password is incorrect" };
  if (String(fd.get("confirm") ?? "") !== "DELETE") return { error: 'Type DELETE to confirm' };
  await db.user.delete({ where: { id: u.id } });
  return { ok: true, message: "Your account has been deleted" };
}

export async function exportMyData(): Promise<ActionState> {
  const u = await currentUser();
  if (!u) return { error: "Unauthorized" };
  const [user, links, bioPages, qrCodes, campaigns, domains, payments, files] = await Promise.all([
    db.user.findUnique({ where: { id: u.id }, select: { id: true, username: true, email: true, name: true, avatar: true, language: true, timezone: true, createdAt: true, planId: true, planExpires: true, isPublic: true } }),
    db.link.findMany({ where: { userId: u.id }, select: { alias: true, url: true, title: true, clicks: true, createdAt: true } }),
    db.bioPage.findMany({ where: { userId: u.id }, select: { alias: true, name: true, bio: true, views: true, createdAt: true, blocks: { select: { type: true, title: true, url: true, content: true } } } }),
    db.qrCode.findMany({ where: { userId: u.id } }),
    db.campaign.findMany({ where: { userId: u.id } }),
    db.domain.findMany({ where: { userId: u.id }, select: { domain: true, status: true } }),
    db.payment.findMany({ where: { userId: u.id }, select: { invoiceNumber: true, amount: true, currency: true, status: true, gateway: true, createdAt: true } }),
    db.hostedFile.findMany({ where: { userId: u.id }, select: { alias: true, name: true, size: true, downloads: true } }),
  ]);
  return { ok: true, data: JSON.stringify({ exportedAt: new Date().toISOString(), user, links, bioPages, qrCodes, campaigns, domains, payments, files }, null, 2) };
}
