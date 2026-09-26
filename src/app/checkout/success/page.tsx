import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Payment successful" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ payment?: string; trial?: string; voucher?: string }> }) {
  const sp = await searchParams;
  const u = await currentUser();
  const payment = sp.payment && u ? await db.payment.findFirst({ where: { id: sp.payment, userId: u.id } }) : null;
  const pending = payment?.status === "pending";
  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-success mb-4" />
        <h1 className="text-2xl font-bold mb-2">{sp.trial ? "Your trial has started" : sp.voucher ? "Voucher redeemed" : pending ? "Payment received" : "Thank you!"}</h1>
        <p className="text-muted text-sm mb-6">
          {sp.trial ? "Enjoy all premium features during your trial." : pending ? "We are confirming your payment with the provider. Your plan will be activated within a few minutes (bank transfers are activated once confirmed by our team)." : "Your plan is now active. A confirmation email is on its way."}
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/dashboard/billing" className="btn-primary">Go to billing</Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
