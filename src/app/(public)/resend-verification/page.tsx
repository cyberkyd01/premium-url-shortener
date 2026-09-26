import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendForm } from "@/components/auth/resend-form";

export const metadata: Metadata = { title: "Resend verification email" };

export default function ResendVerificationPage() {
  return (
    <AuthCard title="Resend verification email" description="Enter the email you registered with and we will send a new verification link." footer={<Link href="/login" className="text-primary">Back to login</Link>}>
      <ResendForm />
    </AuthCard>
  );
}
