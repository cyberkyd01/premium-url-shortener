import Link from "next/link";
import { XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Payment cancelled" };
export const dynamic = "force-dynamic";

export default async function CancelPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  const u = await currentUser();
  if (payment && u) await db.payment.updateMany({ where: { id: payment, userId: u.id, status: "pending" }, data: { status: "failed" } });
  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 text-center">
        <XCircle size={48} className="mx-auto text-muted mb-4" />
        <h1 className="text-2xl font-bold mb-2">Payment cancelled</h1>
        <p className="text-muted text-sm mb-6">No charge was made. You can try again whenever you are ready.</p>
        <div className="flex flex-col gap-2">
          <Link href="/pricing" className="btn-primary">Back to pricing</Link>
          <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
