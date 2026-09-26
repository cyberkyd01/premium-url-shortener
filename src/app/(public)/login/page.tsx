import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { enabledSocialProviders, captchaFor, firstParam } from "@/lib/social";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { ImpersonateSignIn } from "@/components/auth/impersonate-signin";
import { headers } from "next/headers";
import { getBranding } from "@/lib/whitelabel";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const user = await currentUser();
  const invite = firstParam(sp, "invite");
  const callbackUrl = firstParam(sp, "callbackUrl");
  const impersonateToken = firstParam(sp, "token");
  const impersonateAs = firstParam(sp, "as");
  if (impersonateToken && impersonateAs) {
    // Admin "Login as user": the admin is still signed in here, so this runs before the logged-in redirect.
    return (
      <AuthCard title="Switching account" description={`Logging in as ${impersonateAs}…`}>
        <ImpersonateSignIn token={impersonateToken} username={impersonateAs} />
      </AuthCard>
    );
  }
  if (user) redirect(invite ? `/invite/${encodeURIComponent(invite)}` : callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : s["users.postLoginRedirect"] || "/dashboard");
  const providers = enabledSocialProviders(s);
  const socialOnly = s["users.socialOnly"] === "1";
  const brand = await getBranding(await headers());
  return (
    <>
    {brand.custom && brand.logo && <div className="max-w-md mx-auto px-4 pt-10 -mb-8 text-center"><img src={brand.logo} alt={brand.name} className="h-10 inline-block" /></div>}
    <AuthCard
      title={brand.loginTitle}
      description={invite ? "Log in to accept your team invitation." : `Log in to your ${brand.name} account.`}
      footer={s["users.registration"] === "1" && <>No account yet? <Link href={`/register${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`} className="text-primary">Sign up</Link></>}
    >
      {!socialOnly && <LoginForm captcha={captchaFor(s, "onLogin")} callbackUrl={callbackUrl} invite={invite} initialError={firstParam(sp, "error")} magicLink={(s["users.magicLink"] ?? "") !== "0"} />}
      <SocialButtons providers={providers} callbackUrl={invite ? `/invite/${encodeURIComponent(invite)}` : callbackUrl} label={socialOnly ? "Continue with" : "or continue with"} />
      {socialOnly && !providers.length && <p className="text-sm text-muted">No login methods are configured. Please contact the administrator.</p>}
    </AuthCard>
    </>
  );
}
