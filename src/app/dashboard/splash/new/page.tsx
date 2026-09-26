import Link from "next/link";
import { redirect } from "next/navigation";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan, withinLimit } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { PageHeader, Alert } from "@/components/ui";
import { SplashForm } from "@/components/splash/splash-form";

export const metadata = { title: "New splash page" };

export default async function NewSplashPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  if (!can(ws, "splash", "create")) redirect("/dashboard/splash");
  const [{ features, user }, limit, s] = await Promise.all([getUserPlan(ws.ownerId), withinLimit(ws.ownerId, "limitSplash"), getSettings()]);
  const isAdmin = user.role === "admin";
  if (!isAdmin && !features.customSplash) redirect("/dashboard/splash");
  if (!limit.ok) return <div><PageHeader title="New splash page" /><Alert type="warning">You have reached the limit of {limit.limit} splash pages. <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link> to continue.</Alert></div>;
  return (
    <div>
      <PageHeader title="New splash page" description="Design the page visitors see before the redirect." />
      <SplashForm allowCss={isAdmin || features.customCss} adsAllowed={s["splash.ads"] === "1" || isAdmin} />
    </div>
  );
}
