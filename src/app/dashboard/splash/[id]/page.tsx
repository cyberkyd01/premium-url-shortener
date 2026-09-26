import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { PageHeader, Alert, Badge, Button } from "@/components/ui";
import { ConfirmForm } from "@/components/ui/confirm";
import { SplashForm } from "@/components/splash/splash-form";
import { deleteSplash } from "../actions";
import { Trash2 } from "lucide-react";

export const metadata = { title: "Edit splash page" };

export default async function EditSplashPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const [splash, { features, user }, s] = await Promise.all([db.splashPage.findFirst({ where: { id, userId: ws.ownerId }, include: { _count: { select: { links: true } } } }), getUserPlan(ws.ownerId), getSettings()]);
  if (!splash) notFound();
  const isAdmin = user.role === "admin";
  const canEdit = can(ws, "splash", "edit") && (isAdmin || features.customSplash);
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2">{splash.name}{splash.isDefault && <Badge color="blue">Default</Badge>}</span>} description={`Used by ${splash._count.links} link(s)`}
        actions={can(ws, "splash", "delete") ? <ConfirmForm action={deleteSplash} hidden={{ id: splash.id, redirect: "1" }} message="Delete this splash page? Links using it fall back to the default."><Button type="submit" variant="danger" size="sm"><Trash2 size={14} />Delete</Button></ConfirmForm> : undefined} />
      {created && <div className="mb-4"><Alert type="success">Splash page created. Choose it in the link editor under redirect type “Custom splash”.</Alert></div>}
      {!canEdit && <div className="mb-4"><Alert type="warning">You cannot edit splash pages{!isAdmin && !features.customSplash ? " on your current plan" : " with your team permissions"}.</Alert></div>}
      <SplashForm allowCss={isAdmin || features.customCss} adsAllowed={s["splash.ads"] === "1" || isAdmin} splash={{ id: splash.id, name: splash.name, title: splash.title, description: splash.description, logo: splash.logo, image: splash.image, buttonText: splash.buttonText, buttonColor: splash.buttonColor, bgColor: splash.bgColor, textColor: splash.textColor, countdown: splash.countdown, showAds: splash.showAds, adCode: splash.adCode, customCss: splash.customCss, customHtml: splash.customHtml, isDefault: splash.isDefault }} />
    </div>
  );
}
