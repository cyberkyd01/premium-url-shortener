"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { act } from "@/lib/admin/guard";
import { str, optStr, int, bool, date, ids } from "@/lib/admin/query";
import { hashPassword } from "@/lib/auth";
import { sendMail, sendTemplate } from "@/lib/mail";
import { appUrl, generateApiKey, randomToken, escapeHtml } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form-state";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

async function roleData(fd: FormData) {
  const role = str(fd, "role"); // "admin" | "user" | role:<id>
  if (role.startsWith("role:")) {
    const r = await db.role.findUnique({ where: { id: role.slice(5) } });
    if (!r) throw new Error("Role not found");
    return { role: "admin", roleId: r.id };
  }
  return { role: role === "admin" ? "admin" : "user", roleId: null };
}

export async function createUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("users.manage", async () => {
    const username = str(fd, "username"), email = str(fd, "email").toLowerCase(), password = str(fd, "password");
    if (!USERNAME_RE.test(username)) return { ok: false, error: "Username must be 3-30 letters, numbers or underscores." };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Invalid email address." };
    if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    if (await db.user.findFirst({ where: { OR: [{ username }, { email }] } })) return { ok: false, error: "Username or email already exists." };
    const planId = optStr(fd, "planId") ?? (await db.plan.findFirst({ where: { isFree: true } }))?.id ?? null;
    const user = await db.user.create({ data: {
      username, email, name: optStr(fd, "name"), password: await hashPassword(password), planId, planExpires: date(fd, "planExpires"),
      ...(await roleData(fd)), status: int(fd, "status", 1), emailVerified: new Date(), apiKey: generateApiKey(), affiliateCode: randomToken(4), verified: bool(fd, "verified"),
    } });
    if (bool(fd, "sendWelcome")) await sendTemplate("welcome", email, { name: user.name ?? username }, user.language);
    revalidatePath("/admin/users");
    redirect(`/admin/users/${user.id}`);
  });
}

export async function updateUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("users.manage", async () => {
    const id = str(fd, "id");
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };
    const username = str(fd, "username"), email = str(fd, "email").toLowerCase();
    if (!USERNAME_RE.test(username)) return { ok: false, error: "Invalid username." };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Invalid email address." };
    const dup = await db.user.findFirst({ where: { OR: [{ username }, { email }], NOT: { id } } });
    if (dup) return { ok: false, error: "Username or email already used by another account." };
    const password = str(fd, "password");
    await db.user.update({ where: { id }, data: {
      username, email, name: optStr(fd, "name"), avatar: optStr(fd, "avatar"), language: str(fd, "language") || "en", timezone: str(fd, "timezone") || "UTC",
      planId: optStr(fd, "planId"), planExpires: date(fd, "planExpires"), planTrialEnds: date(fd, "planTrialEnds"), status: int(fd, "status", 1),
      ...(await roleData(fd)), verified: bool(fd, "verified"), isPublic: bool(fd, "isPublic"), notifyEmail: bool(fd, "notifyEmail"),
      aiCredits: int(fd, "aiCredits", user.aiCredits), affiliateBalance: parseFloat(str(fd, "affiliateBalance")) || 0, postLoginRedirect: optStr(fd, "postLoginRedirect"),
      ...(password ? { password: await hashPassword(password) } : {}),
      ...(bool(fd, "verifyEmail") && !user.emailVerified ? { emailVerified: new Date(), status: user.status === 2 ? 1 : int(fd, "status", 1), verificationToken: null } : {}),
      ...(bool(fd, "disable2fa") ? { twoFactorEnabled: false, twoFactorSecret: null } : {}),
    } });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return { ok: true, message: "User updated." };
  });
}

export async function userQuick(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("users.manage", async (admin) => {
    const id = str(fd, "id"), op = str(fd, "op");
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };
    switch (op) {
      case "ban": if (id === admin.id) return { ok: false, error: "You cannot ban yourself." }; await db.user.update({ where: { id }, data: { status: 0 } }); break;
      case "unban": await db.user.update({ where: { id }, data: { status: 1 } }); break;
      case "verifyBadge": await db.user.update({ where: { id }, data: { verified: !user.verified } }); break;
      case "resendVerification": {
        const token = user.verificationToken || randomToken(24);
        await db.user.update({ where: { id }, data: { verificationToken: token, status: user.emailVerified ? user.status : 2 } });
        await sendTemplate("verify-email", user.email, { name: user.name ?? user.username, link: appUrl(`/verify/${token}`) }, user.language);
        return { ok: true, message: "Verification email sent." };
      }
      case "resetPassword": {
        const token = randomToken(24);
        await db.user.update({ where: { id }, data: { resetToken: token, resetExpires: new Date(Date.now() + 3600000) } });
        await sendTemplate("reset-password", user.email, { name: user.name ?? user.username, link: appUrl(`/reset/${token}`) }, user.language);
        return { ok: true, message: "Password reset email sent." };
      }
      case "resetAi": await db.user.update({ where: { id }, data: { aiCredits: 0, aiCreditsResetAt: new Date() } }); break;
      case "regenerateApiKey": await db.user.update({ where: { id }, data: { apiKey: generateApiKey() } }); break;
      case "loginAs": {
        const token = randomToken(24);
        await db.user.update({ where: { id }, data: { resetToken: token, resetExpires: new Date(Date.now() + 5 * 60 * 1000) } });
        redirect(`/login?token=${token}&as=${encodeURIComponent(user.username)}`);
      }
      case "delete": {
        if (id === admin.id) return { ok: false, error: "You cannot delete yourself." };
        await db.user.delete({ where: { id } });
        revalidatePath("/admin/users");
        redirect("/admin/users");
      }
      default: return { ok: false, error: "Unknown action." };
    }
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return { ok: true, message: "Done." };
  });
}

export async function bulkUsers(_p: ActionState, fd: FormData): Promise<ActionState> {
  return act("users.manage", async (admin) => {
    const selected = ids(fd).filter((i) => i !== admin.id);
    const op = str(fd, "bulk");
    if (!selected.length) return { ok: false, error: "Select at least one user." };
    if (op === "ban") await db.user.updateMany({ where: { id: { in: selected } }, data: { status: 0 } });
    else if (op === "activate") await db.user.updateMany({ where: { id: { in: selected } }, data: { status: 1 } });
    else if (op === "delete") await db.user.deleteMany({ where: { id: { in: selected } } });
    else if (op.startsWith("plan:")) await db.user.updateMany({ where: { id: { in: selected } }, data: { planId: op.slice(5) || null } });
    else if (op === "email") {
      const subject = str(fd, "subject"), body = str(fd, "body", 50000);
      if (!subject || !body) return { ok: false, error: "Subject and message are required for emails." };
      const users = await db.user.findMany({ where: { id: { in: selected } }, select: { email: true, username: true } });
      for (const u of users) await sendMail({ to: u.email, subject, html: body.replace(/\{\{\s*username\s*\}\}/g, escapeHtml(u.username)) });
      return { ok: true, message: `Email sent to ${users.length} users.` };
    } else return { ok: false, error: "Unknown bulk action." };
    revalidatePath("/admin/users");
    return { ok: true, message: `Applied to ${selected.length} users.` };
  });
}
