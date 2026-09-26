import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { acceptInvite } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Team invitation" };

/** Accepts a team invitation. Guests are sent to /register?invite=token (which links to login as well). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  if (!user) redirect(`/register?invite=${encodeURIComponent(token)}`);
  const result = await acceptInvite(token);
  if (result.ok) redirect("/dashboard?team=joined");
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold mb-2">Invitation unavailable</h1>
        <p className="text-muted text-sm">{result.error}</p>
        <Link href="/dashboard" className="btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
