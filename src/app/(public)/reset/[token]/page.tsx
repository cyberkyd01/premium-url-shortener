import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await getSettings();
  const user = await db.user.findFirst({ where: { resetToken: token }, select: { resetExpires: true } });
  const valid = !!user && !!user.resetExpires && user.resetExpires > new Date();
  return (
    <AuthCard title="Choose a new password" footer={<Link href="/login" className="text-primary">Back to login</Link>}>
      {valid ? (
        <ResetForm token={token} minPasswordLength={parseInt(s["security.passwordMinLength"] || "8", 10)} />
      ) : (
        <div className="space-y-4">
          <Alert type="error">This password reset link is invalid or has expired.</Alert>
          <Link href="/forgot" className="btn-secondary w-full">Request a new link</Link>
        </div>
      )}
    </AuthCard>
  );
}
