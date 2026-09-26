import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { captchaFor } from "@/lib/social";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPage() {
  const s = await getSettings();
  return (
    <AuthCard title="Reset your password" description="Enter your email and we will send you a link to choose a new password." footer={<Link href="/login" className="text-primary">Back to login</Link>}>
      <ForgotForm captcha={captchaFor(s, "onPassword")} />
    </AuthCard>
  );
}
