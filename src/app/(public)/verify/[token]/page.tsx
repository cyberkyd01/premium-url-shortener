import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = token ? await db.user.findFirst({ where: { verificationToken: token } }) : null;
  if (user) {
    await db.user.update({ where: { id: user.id }, data: { status: user.status === 0 ? 0 : 1, emailVerified: new Date(), verificationToken: null } });
  }
  return (
    <AuthCard title={user ? "Email verified" : "Invalid link"}>
      {user ? (
        <div className="space-y-4">
          <Alert type="success">Your email address has been verified. You can now log in.</Alert>
          <Link href="/login" className="btn-primary w-full py-2.5">Log in</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert type="error">This verification link is invalid or has already been used.</Alert>
          <Link href="/resend-verification" className="btn-secondary w-full">Request a new verification email</Link>
        </div>
      )}
    </AuthCard>
  );
}
