import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { authConfig } from "./auth.config";
import { slugify, randomToken, generateApiKey } from "./utils";
import { getSetting } from "./settings";
import { authenticator } from "otplib";
import { checkRegistrationAllowed, afterUserRegistered } from "./security";

/** Normalizes a typed backup code: lowercase, no spaces/dashes (codes are shown as xxxx-xxxx). */
export function normalizeBackupCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Compares `code` against the user's hashed one-time backup codes; on a match the code is removed. */
async function consumeBackupCode(userId: string, stored: string, code: string) {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== 8) return false;
  let hashes: string[] = [];
  try { const parsed: unknown = JSON.parse(stored); if (Array.isArray(parsed)) hashes = parsed.filter((h): h is string => typeof h === "string"); } catch { return false; }
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      hashes.splice(i, 1);
      await db.user.update({ where: { id: userId }, data: { backupCodes: JSON.stringify(hashes) } });
      return true;
    }
  }
  return false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: { login: {}, password: {}, otp: {} },
      async authorize(creds) {
        const login = String(creds?.login ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!login || !password) return null;
        const user = await db.user.findFirst({ where: { OR: [{ email: login }, { username: login }] } });
        if (!user || !user.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          await db.loginHistory.create({ data: { userId: user.id, success: false } }).catch(() => {});
          return null;
        }
        if (user.status === 0) throw new Error("BANNED");
        if (user.status === 2 && (await getSetting("users.emailVerification")) === "1") throw new Error("UNVERIFIED");
        if (user.twoFactorEnabled) {
          const otp = String(creds?.otp ?? "");
          if (!otp) throw new Error("OTP_REQUIRED");
          let valid = false;
          if (user.twoFactorMethod === "email") {
            valid = !!user.emailOtp && user.emailOtp === otp && !!user.emailOtpExpires && user.emailOtpExpires > new Date();
            if (valid) await db.user.update({ where: { id: user.id }, data: { emailOtp: null, emailOtpExpires: null } });
          } else if (user.twoFactorSecret) {
            valid = authenticator.check(otp, user.twoFactorSecret);
          }
          if (!valid) valid = await consumeBackupCode(user.id, user.backupCodes, otp);
          if (!valid) throw new Error("OTP_INVALID");
        }
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await db.loginHistory.create({ data: { userId: user.id, success: true } }).catch(() => {});
        return { id: user.id, email: user.email, name: user.name ?? user.username, image: user.avatar, role: user.role, username: user.username };
      },
    }),
    // Passwordless login: the token is emailed by `requestMagicLink()` and consumed once here.
    Credentials({
      id: "magic",
      name: "Magic link",
      credentials: { token: {} },
      async authorize(creds) {
        const token = String(creds?.token ?? "").trim();
        if (!token || token.length < 16) return null;
        const user = await db.user.findFirst({ where: { magicToken: token } });
        if (!user) return null;
        if (!user.magicExpires || user.magicExpires < new Date()) {
          await db.user.update({ where: { id: user.id }, data: { magicToken: null, magicExpires: null } }).catch(() => {});
          throw new Error("MAGIC_EXPIRED");
        }
        if (user.status === 0) throw new Error("BANNED");
        if (user.status === 2 && (await getSetting("users.emailVerification")) === "1") throw new Error("UNVERIFIED");
        await db.user.update({ where: { id: user.id }, data: { magicToken: null, magicExpires: null, lastLoginAt: new Date(), emailVerified: user.emailVerified ?? new Date() } });
        await db.loginHistory.create({ data: { userId: user.id, success: true, userAgent: "magic-link" } }).catch(() => {});
        return { id: user.id, email: user.email, name: user.name ?? user.username, image: user.avatar, role: user.role, username: user.username };
      },
    }),
    // Admin "Login as user": the admin panel stores a 5-minute token in resetToken/resetExpires and redirects to /login?token=&as=.
    Credentials({
      id: "impersonate",
      name: "Impersonate",
      credentials: { token: {}, username: {} },
      async authorize(creds) {
        const token = String(creds?.token ?? "").trim();
        const username = String(creds?.username ?? "").trim().toLowerCase();
        if (!token || token.length < 16 || !username) return null;
        const user = await db.user.findFirst({ where: { resetToken: token } });
        if (!user || user.username.toLowerCase() !== username) return null;
        if (!user.resetExpires || user.resetExpires < new Date()) {
          await db.user.update({ where: { id: user.id }, data: { resetToken: null, resetExpires: null } }).catch(() => {});
          throw new Error("IMPERSONATE_EXPIRED");
        }
        await db.user.update({ where: { id: user.id }, data: { resetToken: null, resetExpires: null } });
        await db.loginHistory.create({ data: { userId: user.id, success: true, userAgent: "admin-impersonation" } }).catch(() => {});
        return { id: user.id, email: user.email, name: user.name ?? user.username, image: user.avatar, role: user.role, username: user.username };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "credentials" || account?.provider === "magic" || account?.provider === "impersonate") return true;
      // OAuth: ensure a local user exists
      const email = user.email?.toLowerCase();
      if (!email) return false;
      let dbUser = await db.user.findUnique({ where: { email } });
      if (!dbUser) {
        if ((await getSetting("users.registration")) !== "1") return false;
        const gate = await checkRegistrationAllowed({ email });
        if (!gate.ok) return false;
        const base = slugify(user.name || email.split("@")[0]) || "user";
        let username = base;
        let i = 1;
        while (await db.user.findUnique({ where: { username } })) username = `${base}${i++}`;
        const defaultPlanId = (await getSetting("users.defaultPlan")) || (await db.plan.findFirst({ where: { isFree: true } }))?.id || null;
        dbUser = await db.user.create({
          data: { email, username, name: user.name, avatar: user.image, emailVerified: new Date(), status: 1, planId: defaultPlanId, apiKey: generateApiKey(), affiliateCode: randomToken(4) },
        });
        afterUserRegistered({ id: dbUser.id, username: dbUser.username, email: dbUser.email, plan: dbUser.planId, createdAt: dbUser.createdAt }).catch(() => {});
      }
      if (dbUser.status === 0) return false;
      await db.account.upsert({
        where: { provider_providerAccountId: { provider: account!.provider, providerAccountId: account!.providerAccountId } },
        create: { userId: dbUser.id, type: account!.type, provider: account!.provider, providerAccountId: account!.providerAccountId, access_token: account!.access_token, refresh_token: account!.refresh_token, expires_at: account!.expires_at, token_type: account!.token_type, scope: account!.scope, id_token: account!.id_token },
        update: { access_token: account!.access_token },
      }).catch(() => {});
      (user as { id?: string }).id = dbUser.id;
      (user as { role?: string }).role = dbUser.role;
      (user as { username?: string }).username = dbUser.username;
      await db.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
      return true;
    },
  },
});

/** Returns the current session user (id, role, username) or null. */
export async function currentUser() {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string; username?: string; email?: string; name?: string } | undefined;
  if (!u?.id) return null;
  return { id: u.id, role: u.role ?? "user", username: u.username ?? "", email: u.email ?? "", name: u.name ?? "" };
}

/** Throws (redirect-safe) if not logged in. */
export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

export async function requireAdmin() {
  const u = await currentUser();
  if (!u || u.role !== "admin") throw new Error("FORBIDDEN");
  return u;
}

/** Full DB user record for the session. */
export async function currentDbUser() {
  const u = await currentUser();
  if (!u) return null;
  return db.user.findUnique({ where: { id: u.id }, include: { plan: true, roleRel: true } });
}

/** Admin permission check: full admins pass; custom roles must include the key. */
export async function hasAdminPermission(permission: string) {
  const user = await currentDbUser();
  if (!user) return false;
  if (user.role === "admin" && !user.roleRel) return true;
  if (user.roleRel?.isAdmin) return true;
  try {
    const perms = JSON.parse(user.roleRel?.permissions ?? "[]") as string[];
    return perms.includes("*") || perms.includes(permission);
  } catch {
    return false;
  }
}

export async function hashPassword(p: string) {
  return bcrypt.hash(p, 10);
}
