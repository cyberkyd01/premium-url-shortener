import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getActiveLanguages } from "@/lib/i18n";
import { getUserPlan } from "@/lib/plan";
import { Alert, PageHeader } from "@/components/ui";
import { cn, json } from "@/lib/utils";
import { ProfileForm } from "./profile-form";
import { SecurityTab } from "./security-tab";
import { ApiTab } from "./api-tab";
import { VerificationTab } from "./verification-tab";
import { DangerTab } from "./danger-tab";
import { resendVerification } from "./actions";

export const metadata = { title: "Account settings" };

const TABS = [
  { key: "profile", label: "Profile" }, { key: "security", label: "Security" }, { key: "api", label: "API" },
  { key: "verification", label: "Verification" }, { key: "danger", label: "Danger zone" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; resend?: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const sp = await searchParams;
  const s = await getSettings();
  const user = await db.user.findUnique({ where: { id: ws.userId }, include: { accounts: true, apiKeys: { orderBy: { createdAt: "desc" } }, loginHistory: { orderBy: { createdAt: "desc" }, take: 20 }, verificationRequests: { orderBy: { createdAt: "desc" } } } });
  if (!user) redirect("/login");
  let resent: string | null = null;
  if (sp.resend === "1") { const r = await resendVerification(); resent = r?.message ?? r?.error ?? null; }
  const tabs = TABS.filter((t) => t.key !== "verification" || s["users.verificationSystem"] === "1");
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "profile";
  const [languages, planInfo] = await Promise.all([getActiveLanguages(), getUserPlan(user.id)]);
  const timezones = (() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return ["UTC"]; } })();
  if (!timezones.includes(user.timezone)) timezones.unshift(user.timezone);

  return (
    <div>
      <PageHeader title="Account settings" description="Manage your profile, security, API access and account." />
      {resent && <div className="mb-4"><Alert type="info">{resent}</Alert></div>}
      {user.status === 2 && <div className="mb-4"><Alert type="warning">Your email address is not verified. <Link href="/dashboard/settings?resend=1" className="underline">Resend verification email</Link></Alert></div>}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((t) => <Link key={t.key} href={`/dashboard/settings?tab=${t.key}`} className={cn("px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap", tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-fg")}>{t.label}</Link>)}
      </div>
      {tab === "profile" && <ProfileForm user={{ name: user.name, username: user.username, email: user.email, avatar: user.avatar, gravatar: user.gravatar, timezone: user.timezone, language: user.language, isPublic: user.isPublic, postLoginRedirect: user.postLoginRedirect, notifyEmail: user.notifyEmail, verified: user.verified, reportFrequency: user.reportFrequency }} languages={languages.map((l) => ({ code: l.code, name: l.name }))} settings={{ gravatar: s["users.gravatar"] === "1", publicAccounts: s["users.publicAccounts"] === "1", emailVerification: s["users.emailVerification"] === "1" }} timezones={timezones} />}
      {tab === "security" && <SecurityTab user={{ hasPassword: !!user.password, twoFactorEnabled: user.twoFactorEnabled, twoFactorMethod: user.twoFactorMethod, emailVerified: !!user.emailVerified, backupCodesCount: json<unknown[]>(user.backupCodes, []).length }} settings={{ twoFactor: s["users.twoFactor"] === "1", emailTwoFactor: s["users.emailTwoFactor"] === "1", siteName: s["site.name"] }} accounts={user.accounts.map((a) => ({ id: a.id, provider: a.provider }))} history={user.loginHistory.map((h) => ({ id: h.id, ip: h.ip, userAgent: h.userAgent, country: h.country, success: h.success, createdAt: h.createdAt.toISOString() }))} pendingReset={user.verificationRequests.some((v) => v.type === "2fa_reset" && v.status === "pending")} />}
      {tab === "api" && <ApiTab apiKey={user.apiKey} keys={user.apiKeys.map((k) => ({ id: k.id, name: k.name, key: k.key, permissions: k.permissions, active: k.active, requests: k.requests, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} limit={user.role === "admin" ? -1 : planInfo.plan?.limitApiKeys ?? 1} hasApi={user.role === "admin" || planInfo.features.api} isAdmin={user.role === "admin"} apiEnabled={s["api.enabled"] === "1"} />}
      {tab === "verification" && <VerificationTab verified={user.verified} requests={user.verificationRequests.filter((v) => v.type === "badge").map((v) => ({ id: v.id, status: v.status, message: v.message, createdAt: v.createdAt.toISOString() }))} />}
      {tab === "danger" && <DangerTab canDelete={s["users.deleteAccount"] === "1" && user.role !== "admin"} hasPassword={!!user.password} />}
    </div>
  );
}
