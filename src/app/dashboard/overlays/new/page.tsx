import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { PageHeader, Alert } from "@/components/ui";
import { OverlayForm } from "@/components/overlays/overlay-form";

export const metadata = { title: "New overlay" };

export default async function NewOverlayPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "overlays", "create")) redirect("/dashboard/overlays");
  const [{ features, user }, limit] = await Promise.all([getUserPlan(ws.ownerId), withinLimit(ws.ownerId, "limitOverlays")]);
  if (user.role !== "admin" && !features.overlays) redirect("/dashboard/overlays");
  if (!limit.ok) return <div><PageHeader title="New overlay" /><Alert type="warning">You have reached the limit of {limit.limit} overlays. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to continue.</Alert></div>;
  return (
    <div>
      <PageHeader title="New overlay" description="Design a widget that appears on top of the destination page." />
      <OverlayForm />
    </div>
  );
}
