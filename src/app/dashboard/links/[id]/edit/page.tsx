import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { parseLinkJson, shortUrl } from "@/lib/links";
import { json } from "@/lib/utils";
import { PageHeader, Alert } from "@/components/ui";
import { LinkForm } from "@/components/links/link-form";
import { loadLinkFormOptions } from "@/components/links/form-options";
import type { LinkPayload } from "@/components/links/link-schema";

export const metadata = { title: "Edit link" };

function toLocalInput(d: Date | null) {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const { id } = await params;
  const link = await db.link.findFirst({ where: { id, userId: ws.ownerId }, include: { pixels: true, domain: true } });
  if (!link) notFound();
  const options = await loadLinkFormOptions(ws);
  options.hasPassword = !!link.password;
  const p = parseLinkJson(link);
  const initial: Partial<LinkPayload> = {
    url: link.url, alias: link.alias, domainId: link.domainId, title: link.title, description: link.description, image: link.image,
    redirectType: link.redirectType, splashId: link.splashId, overlayId: link.overlayId, expiresAt: toLocalInput(link.expiresAt), expiredUrl: link.expiredUrl,
    clickLimit: link.clickLimit, clickLimitUrl: link.clickLimitUrl, channelId: link.channelId, campaignId: link.campaignId, pixelIds: link.pixels.map((x) => x.pixelId),
    utm: p.utm, customParams: p.customParams, forwardParams: link.forwardParams, geoTargets: p.geoTargets, deviceTargets: p.deviceTargets, langTargets: p.langTargets,
    timeTargets: p.timeTargets, conditions: p.conditions, abUrls: p.abUrls, rotatorMode: link.rotatorMode, deepLink: link.deepLink, deepLinkConfig: p.deepLinkConfig,
    cloaking: link.cloaking, botBlock: link.botBlock, inAppBreakout: link.inAppBreakout, isPublic: link.isPublic, notes: link.notes,
    tags: link.tags.split(",").map((t) => t.trim()).filter(Boolean), activateAt: toLocalInput(link.activateAt),
    blockCountries: json<string[]>(link.blockCountries, []), blockIps: json<string[]>(link.blockIps, []).join("\n"),
    fallbackUrl: link.fallbackUrl, alertThreshold: link.alertThreshold,
  };
  return (
    <>
      <PageHeader title="Edit link" description={<a href={shortUrl(link)} target="_blank" rel="noreferrer" className="text-primary">{shortUrl(link)}</a>} actions={<><Link href={`/dashboard/links/${id}`} className="btn-secondary btn-sm">Statistics</Link><Link href="/dashboard/links" className="btn-ghost btn-sm">All links</Link></>} />
      {can(ws, "links", "edit") ? <LinkForm options={options} initial={initial} id={id} /> : <Alert type="error">You do not have permission to edit links in this team.</Alert>}
    </>
  );
}
