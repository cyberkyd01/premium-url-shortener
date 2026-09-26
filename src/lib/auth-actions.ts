"use server";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { getSettings } from "./settings";
import { currentUser, hashPassword } from "./auth";
import { verifyCaptcha } from "./captcha";
import { sendTemplate } from "./mail";
import { rateLimit } from "./api-auth";
import { parseVisitor } from "./geo";
import { afterUserRegistered, checkRegistrationAllowed } from "./security";
import { appUrl, generateApiKey, randomToken } from "./utils";
import type { ActionState } from "@/components/ui/form-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/** Small builtin list of disposable email providers (used when security.disposableEmails=1). */
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "yopmail.com", "yopmail.fr", "trashmail.com", "trashmail.net", "getnada.com", "dispostable.com", "maildrop.cc", "sharklasers.com",
  "throwawaymail.com", "fakeinbox.com", "mailnesia.com", "mintemail.com", "spamgourmet.com", "tempr.email", "discard.email", "mohmal.com",
  "emailondeck.com", "burnermail.io", "moakt.com", "tmpmail.org", "tmpmail.net", "mailsac.com", "inboxkitten.com", "harakirimail.com",
];

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

function safeRedirect(url: string | null | undefined, fallback: string) {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const u = new URL(url);
    const app = new URL(appUrl());
    if (u.host === app.host) return u.pathname + u.search;
  } catch {
    /* ignore */
  }
  return fallback;
}

export interface LoginPrecheck {
  ok: boolean;
  code?: "INVALID" | "BANNED" | "UNVERIFIED" | "OTP_REQUIRED" | "CAPTCHA";
  error?: string;
  twoFactorMethod?: "app" | "email";
  redirectTo?: string;
}

/**
 * Verifies credentials before calling `signIn("credentials")` on the client so that the UI can
 * show precise messages (banned, unverified, two-factor required) and compute the post-login redirect.
 */
export async function precheckLogin(input: { login: string; password: string; captcha?: string | null; callbackUrl?: string | null }): Promise<LoginPrecheck> {
  const s = await getSettings();
  const login = input.login.trim().toLowerCase();
  const password = input.password;
  if (!login || !password) return { ok: false, code: "INVALID", error: "Please enter your login and password." };
  if (s["captcha.onLogin"] === "1" && !(await verifyCaptcha(input.captcha, await clientIp()))) return { ok: false, code: "CAPTCHA", error: "Captcha verification failed." };
  const user = await db.user.findFirst({ where: { OR: [{ email: login }, { username: login }] } });
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    return { ok: false, code: "INVALID", error: "Invalid login or password." };
  }
  if (user.status === 0) return { ok: false, code: "BANNED", error: "Your account has been suspended. Please contact support." };
  if (user.status === 2 && s["users.emailVerification"] === "1") return { ok: false, code: "UNVERIFIED", error: "Please verify your email address first." };
  const redirectTo = safeRedirect(input.callbackUrl, user.postLoginRedirect || s["users.postLoginRedirect"] || "/dashboard");
  if (user.twoFactorEnabled) {
    return { ok: true, code: "OTP_REQUIRED", twoFactorMethod: user.twoFactorMethod === "email" ? "email" : "app", redirectTo };
  }
  return { ok: true, redirectTo };
}

/** Email two-factor: verifies the password, generates a 6-digit code valid for 10 minutes and emails it. */
export async function requestEmailOtp(login: string, password: string): Promise<ActionState> {
  const l = login.trim().toLowerCase();
  const user = await db.user.findFirst({ where: { OR: [{ email: l }, { username: l }] } });
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) return { ok: false, error: "Invalid login or password." };
  if (!user.twoFactorEnabled || user.twoFactorMethod !== "email") return { ok: false, error: "Email verification is not enabled for this account." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.user.update({ where: { id: user.id }, data: { emailOtp: code, emailOtpExpires: new Date(Date.now() + 10 * 60 * 1000) } });
  await sendTemplate("two-factor", user.email, { name: user.name ?? user.username, code }, user.language);
  return { ok: true, message: "We sent a verification code to your email address." };
}

async function resolveDefaultPlanId(value: string) {
  if (value) {
    const p = await db.plan.findFirst({ where: { OR: [{ id: value }, { slug: value }] }, select: { id: true, trialDays: true } });
    if (p) return p;
  }
  return db.plan.findFirst({ where: { isFree: true }, select: { id: true, trialDays: true } });
}

async function findReferrer(tagType: string, ref: string | undefined) {
  if (!ref) return null;
  const where = tagType === "username" ? { username: ref } : { affiliateCode: ref };
  return db.user.findFirst({ where, select: { id: true } });
}

/** Creates an account from the /register form. Returns `data: { verify: boolean; redirectTo: string }` on success. */
export async function registerUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await getSettings();
  if (s["users.registration"] !== "1") return { ok: false, error: "Registration is currently disabled." };
  if (s["users.socialOnly"] === "1") return { ok: false, error: "Please sign up using one of the social providers." };
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const terms = formData.get("terms");
  const invite = String(formData.get("invite") ?? "").trim();
  const refParam = String(formData.get("ref") ?? "").trim();
  const minLen = parseInt(s["security.passwordMinLength"] || "8", 10);

  if (!USERNAME_RE.test(username)) return { ok: false, error: "Username must be 3-30 characters (letters, numbers, underscores)." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < minLen) return { ok: false, error: `Password must be at least ${minLen} characters.` };
  if (!terms) return { ok: false, error: "You must accept the terms of service." };
  if (s["captcha.onRegister"] === "1" && !(await verifyCaptcha(String(formData.get("captcha") ?? ""), await clientIp()))) return { ok: false, error: "Captcha verification failed." };

  const domain = email.split("@")[1] ?? "";
  const blockedEmails = (s["security.blockedEmails"] || "").split(/[\n,]/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (blockedEmails.some((b) => (b.startsWith("@") ? domain === b.slice(1) : b.includes("@") ? email === b : domain === b))) return { ok: false, error: "This email address is not allowed." };
  const dbBlocked = await db.blockedItem.findFirst({ where: { type: "email", OR: [{ value: email }, { value: domain }, { value: "@" + domain }] } });
  if (dbBlocked) return { ok: false, error: "This email address is not allowed." };
  if (s["security.disposableEmails"] === "1" && DISPOSABLE_DOMAINS.includes(domain)) return { ok: false, error: "Disposable email addresses are not allowed." };
  {
    // Built-in add-ons: Ban IP, Block Countries, Restrict/Block Emails, Email Validation (IPQS)
    const visitor = parseVisitor(await headers());
    const gate = await checkRegistrationAllowed({ email, ip: visitor.ip, countryCode: visitor.countryCode });
    if (!gate.ok) return { ok: false, error: gate.reason ?? "Registration is not allowed." };
  }

  const reserved = (s["links.reservedAliases"] || "").split(",").map((r) => r.trim().toLowerCase());
  if (reserved.includes(username.toLowerCase())) return { ok: false, error: "This username is reserved." };
  if (await db.user.findFirst({ where: { OR: [{ username }, { email }] } })) return { ok: false, error: "An account with this username or email already exists." };

  const plan = await resolveDefaultPlanId(s["users.defaultPlan"]);
  const trial = s["users.trial"] === "1" && plan && plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400000) : null;
  const cookieStore = await cookies();
  const referrer = s["affiliate.enabled"] === "1" ? await findReferrer(s["affiliate.tagType"], cookieStore.get("ref")?.value || refParam || undefined) : null;
  const needsVerification = s["users.emailVerification"] === "1";
  const verificationToken = needsVerification ? randomToken(24) : null;

  let apiKey = generateApiKey();
  while (await db.user.findUnique({ where: { apiKey } })) apiKey = generateApiKey();
  let affiliateCode = randomToken(4);
  while (await db.user.findUnique({ where: { affiliateCode } })) affiliateCode = randomToken(4);

  const user = await db.user.create({
    data: {
      username, email, password: await hashPassword(password), name: username,
      status: needsVerification ? 2 : 1, verificationToken, emailVerified: needsVerification ? null : new Date(),
      planId: plan?.id ?? null, planTrialEnds: trial, apiKey, affiliateCode, referredById: referrer?.id ?? null,
      language: s["site.defaultLanguage"] || "en",
    },
  });
  if (needsVerification && verificationToken) {
    await sendTemplate("verify-email", email, { name: username, link: appUrl(`/verify/${verificationToken}`) });
  } else {
    await sendTemplate("welcome", email, { name: username });
  }
  afterUserRegistered({ id: user.id, username, email, plan: plan?.id ?? null, createdAt: user.createdAt }).catch(() => {}); // Registration Webhook + Mailchimp add-ons
  const redirectTo = invite ? `/invite/${encodeURIComponent(invite)}` : s["users.postLoginRedirect"] || "/dashboard";
  return {
    ok: true,
    message: needsVerification ? "Account created. Please check your email to verify your address." : "Account created.",
    data: { verify: needsVerification, redirectTo, userId: user.id },
  };
}

/** Sends a password reset email (always reports success to avoid account enumeration). */
export async function forgotPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await getSettings();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (s["captcha.onPassword"] === "1" && !(await verifyCaptcha(String(formData.get("captcha") ?? ""), await clientIp()))) return { ok: false, error: "Captcha verification failed." };
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status !== 0) {
    const token = randomToken(24);
    await db.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpires: new Date(Date.now() + 60 * 60 * 1000) } });
    await sendTemplate("reset-password", email, { name: user.name ?? user.username, link: appUrl(`/reset/${token}`) }, user.language);
  }
  return { ok: true, message: "If an account exists for this email, a reset link has been sent." };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await getSettings();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const minLen = parseInt(s["security.passwordMinLength"] || "8", 10);
  if (!token) return { ok: false, error: "Invalid reset link." };
  if (password.length < minLen) return { ok: false, error: `Password must be at least ${minLen} characters.` };
  if (password !== confirm) return { ok: false, error: "Passwords do not match." };
  const user = await db.user.findFirst({ where: { resetToken: token } });
  if (!user || !user.resetExpires || user.resetExpires < new Date()) return { ok: false, error: "This reset link is invalid or has expired." };
  await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password), resetToken: null, resetExpires: null } });
  return { ok: true, message: "Your password has been updated. You can now log in." };
}

export async function resendVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === 2) {
    const token = user.verificationToken || randomToken(24);
    if (!user.verificationToken) await db.user.update({ where: { id: user.id }, data: { verificationToken: token } });
    await sendTemplate("verify-email", email, { name: user.name ?? user.username, link: appUrl(`/verify/${token}`) }, user.language);
  }
  return { ok: true, message: "If your account is pending verification, a new email has been sent." };
}

/** Accepts a team invitation for the logged-in user. */
export async function acceptInvite(token: string): Promise<{ ok: boolean; error?: string; teamName?: string }> {
  const u = await currentUser();
  if (!u) return { ok: false, error: "UNAUTHENTICATED" };
  const invite = await db.teamInvite.findUnique({ where: { token }, include: { team: true } });
  if (!invite) return { ok: false, error: "This invitation does not exist." };
  if (invite.accepted) return { ok: false, error: "This invitation has already been used." };
  if (invite.expiresAt < new Date()) return { ok: false, error: "This invitation has expired." };
  if (invite.team.ownerId === u.id) return { ok: false, error: "You are the owner of this team." };
  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: invite.teamId, userId: u.id } },
    create: { teamId: invite.teamId, userId: u.id, role: invite.role, permissions: invite.permissions },
    update: { role: invite.role, permissions: invite.permissions },
  });
  await db.teamInvite.update({ where: { id: invite.id }, data: { accepted: true } });
  await db.user.update({ where: { id: u.id }, data: { activeTeamId: invite.teamId } });
  return { ok: true, teamName: invite.team.name };
}

// ---------------------------------------------------------------- Magic link (passwordless)
const MAGIC_TTL_MS = 15 * 60 * 1000;

/** Makes sure the editable `magic-link` email template exists (created on first use). */
async function ensureMagicLinkTemplate() {
  const existing = await db.emailTemplate.findUnique({ where: { slug: "magic-link" } });
  if (existing) return;
  await db.emailTemplate.create({
    data: {
      slug: "magic-link",
      subject: "Your login link",
      body: "<p>Hi {{name}},</p><p>Click the button below to log in to {{site_name}}. The link is valid for 15 minutes and can be used once.</p><p><a href=\"{{link}}\" style=\"display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none\">Log in</a></p><p>If you did not request this email you can safely ignore it.</p>",
    },
  }).catch(() => {});
}

/**
 * Emails a one-time login link to an existing account (rate limited per email and IP).
 * Always reports success so that the form cannot be used to enumerate accounts.
 */
export async function requestMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await getSettings();
  if ((s["users.magicLink"] ?? "") === "0") return { ok: false, error: "Login links are disabled." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (s["captcha.onLogin"] === "1" && !(await verifyCaptcha(String(formData.get("captcha") ?? ""), await clientIp()))) return { ok: false, error: "Captcha verification failed." };
  const ip = (await clientIp()) ?? "unknown";
  const success: ActionState = { ok: true, message: "If an account exists for this email, a login link is on its way. Check your inbox." };
  if (!rateLimit(`magic:email:${email}`, 3, 15 * 60_000).ok || !rateLimit(`magic:ip:${ip}`, 10, 15 * 60_000).ok) return success;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === 0) return success;
  const token = randomToken(32);
  await db.user.update({ where: { id: user.id }, data: { magicToken: token, magicExpires: new Date(Date.now() + MAGIC_TTL_MS) } });
  await ensureMagicLinkTemplate();
  await sendTemplate("magic-link", email, { name: user.name ?? user.username, link: appUrl(`/magic/${token}`) }, user.language).catch(() => {});
  return success;
}
