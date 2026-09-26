import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enabledSocialProviders, captchaFor, firstParam } from "@/lib/social";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const user = await currentUser();
  const invite = firstParam(sp, "invite");
  const ref = firstParam(sp, "ref");
  if (user) redirect(invite ? `/invite/${encodeURIComponent(invite)}` : s["users.postLoginRedirect"] || "/dashboard");
  const providers = enabledSocialProviders(s);
  const registration = s["users.registration"] === "1";
  const socialOnly = s["users.socialOnly"] === "1";
  const inviteRow = invite ? await db.teamInvite.findUnique({ where: { token: invite }, include: { team: { select: { name: true } } } }) : null;
  const terms = await db.page.findFirst({ where: { published: true, OR: [{ slug: "terms" }, { slug: "terms-of-service" }] }, select: { slug: true } });
  return (
    <AuthCard
      title={inviteRow ? `Join ${inviteRow.team.name}` : "Create your account"}
      description={inviteRow ? `Create an account to accept your invitation to the "${inviteRow.team.name}" team.` : `Start shortening, branding and tracking links with ${s["site.name"]}.`}
      footer={<>Already have an account? <Link href={`/login${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`} className="text-primary">Log in</Link></>}
    >
      {!registration ? (
        <Alert type="warning">Registration is currently closed.</Alert>
      ) : (
        <>
          {!socialOnly && <RegisterForm captcha={captchaFor(s, "onRegister")} invite={invite} refCode={ref} minPasswordLength={parseInt(s["security.passwordMinLength"] || "8", 10)} termsHref={terms ? `/${terms.slug}` : undefined} />}
          <SocialButtons providers={providers} callbackUrl={invite ? `/invite/${encodeURIComponent(invite)}` : undefined} label={socialOnly ? "Sign up with" : "or sign up with"} />
          {socialOnly && !providers.length && <p className="text-sm text-muted">No sign-up methods are configured. Please contact the administrator.</p>}
        </>
      )}
    </AuthCard>
  );
}
