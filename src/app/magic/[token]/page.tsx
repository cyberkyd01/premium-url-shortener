import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { PublicShell } from "@/components/layout/public-shell";
import { AuthCard } from "@/components/auth/auth-card";
import { MagicSignIn } from "@/components/auth/magic-signin";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Log in with your link" };

/** /magic/[token] — validates the emailed token, then the client signs in through the "magic" credentials provider. */
export default async function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await getSettings();
  const me = await currentUser();
  if (me) redirect(s["users.postLoginRedirect"] || "/dashboard");
  const enabled = (s["users.magicLink"] ?? "") !== "0";
  const user = enabled && token && token.length >= 16 ? await db.user.findFirst({ where: { magicToken: token }, select: { id: true, status: true, magicExpires: true } }) : null;
  const valid = !!user && !!user.magicExpires && user.magicExpires > new Date();
  let problem: string | null = null;
  if (!enabled) problem = "Login links are disabled on this site.";
  else if (!user) problem = "This login link is invalid or has already been used.";
  else if (!valid) problem = "This login link has expired. Request a new one from the login page.";
  else if (user.status === 0) problem = "Your account has been suspended. Please contact support.";
  else if (user.status === 2 && s["users.emailVerification"] === "1") problem = "Please verify your email address before logging in.";
  return (
    <PublicShell>
      <AuthCard title="Logging you in" description={`Welcome back to ${s["site.name"]}.`}>
        {problem ? (
          <div className="space-y-4">
            <Alert type="error">{problem}</Alert>
            <Link href="/login" className="btn-primary w-full py-2.5">Back to login</Link>
          </div>
        ) : (
          <MagicSignIn token={token} callbackUrl={s["users.postLoginRedirect"] || "/dashboard"} />
        )}
      </AuthCard>
    </PublicShell>
  );
}
