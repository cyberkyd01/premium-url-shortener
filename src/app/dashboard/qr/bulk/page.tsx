import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { Alert, PageHeader } from "@/components/ui";
import { BulkGenerator } from "@/components/qr/bulk-generator";

export const metadata = { title: "Bulk QR generator" };

export default async function BulkQrPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["qr.enabled"] !== "1") return <Alert type="warning">QR codes are currently disabled.</Alert>;
  if (!can(ws, "qr", "create")) return <Alert type="error">You do not have permission to create QR codes.</Alert>;
  const { features, user } = await getUserPlan(ws.ownerId);
  const isAdmin = ws.isAdmin || user.role === "admin";
  if (!features.bulkQr && !isAdmin) return <div><PageHeader title="Bulk QR generator" /><Alert type="warning">Bulk QR generation is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to unlock it.</Alert></div>;
  return (
    <div>
      <PageHeader title="Bulk QR generator" description="Paste a list of URLs (or name,url rows) to create many QR codes at once." />
      <BulkGenerator advanced={(features.advancedQr || isAdmin) && s["qr.advanced"] !== "0"} defaultLogo={s["qr.defaultLogo"]} dynamicAllowed={features.dynamicQr || isAdmin} />
    </div>
  );
}
