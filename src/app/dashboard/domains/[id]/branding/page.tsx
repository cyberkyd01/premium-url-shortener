import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getUserPlan } from "@/lib/plan";
import { getSettings } from "@/lib/settings";
import { parseBranding } from "@/lib/whitelabel";
import { PageHeader, Card, Alert } from "@/components/ui";
import { BrandingForm } from "./branding-form";

export const metadata = { title: "White-label branding" };

export default async function DomainBrandingPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const [domain, s, { user, features }] = await Promise.all([db.domain.findFirst({ where: { id, userId: ws.ownerId } }), getSettings(), getUserPlan(ws.ownerId)]);
  if (!domain) notFound();
  const allowed = user.role === "admin" || features.customLogo;
  const b = parseBranding(domain.branding);
  return (
    <>
      <PageHeader title="White-label" description={<>Brand the public pages served on <span className="font-medium text-fg">{domain.domain}</span>: logo, name, colors and login page.</>} actions={<Link href="/dashboard/domains" className="btn-secondary btn-sm">Back to domains</Link>} />
      {domain.status !== 1 && <div className="mb-4"><Alert type="warning">This domain is not verified yet. Branding is applied once the domain is active.</Alert></div>}
      {!allowed && <div className="mb-4"><Alert type="warning">White-label branding is not included in your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to customize your domain.</Alert></div>}
      <Card title="Branding" description="Leave a field empty to fall back to the site defaults.">
        <BrandingForm id={domain.id} domain={domain.domain} siteName={s["site.name"]} disabled={!allowed} initial={{ name: b.name, logo: b.logo, favicon: b.favicon, primary: b.primary, accent: b.accent, hideBranding: b.hideBranding, loginTitle: b.loginTitle }} />
      </Card>
      <p className="hint mt-4">Applies to short link interstitials, bio pages, the login page and other public pages requested via <span className="font-mono">https://{domain.domain}</span>.</p>
    </>
  );
}
