import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan, limitOf } from "@/lib/plan";
import { appUrl, json } from "@/lib/utils";
import { shortUrl } from "@/lib/links";
import { bioUrl } from "@/lib/bio-widgets";
import { qrPayload, encodeQrStyle, normalizeQrStyle } from "@/lib/qr";
import { Alert, PageHeader } from "@/components/ui";
import { QrList, type QrRow } from "@/components/qr/qr-list";

export const metadata = { title: "QR codes" };

export default async function QrListPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["qr.enabled"] !== "1") return <Alert type="warning">QR codes are currently disabled.</Alert>;
  const [{ plan, features, user }, rows, channels] = await Promise.all([
    getUserPlan(ws.ownerId),
    db.qrCode.findMany({ where: { userId: ws.ownerId }, include: { channel: true, link: { include: { domain: true } }, bioPage: { include: { domain: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.channel.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const isAdmin = ws.isAdmin || user.role === "admin";
  const limit = isAdmin ? -1 : limitOf(plan, "limitQrCodes");
  const atLimit = limit !== -1 && rows.length >= limit;
  const base = appUrl("/");
  const list: QrRow[] = rows.map((r) => {
    const payload = qrPayload(r, { shortUrl: r.link ? shortUrl(r.link) : null, bioUrl: r.bioPage ? bioUrl(r.bioPage, base) : null });
    const style = normalizeQrStyle(json(r.style, {}));
    style.size = 160;
    return { id: r.id, name: r.name, type: r.type, scans: r.scans, isDynamic: r.isDynamic, channel: r.channel ? { id: r.channel.id, name: r.channel.name, color: r.channel.color } : null, createdAt: r.createdAt.toISOString(), payload, thumb: `/api/qr/render?data=${encodeURIComponent(payload)}&style=${encodeQrStyle(style)}` };
  });
  return (
    <div>
      <PageHeader title="QR codes" description={limit === -1 ? `${rows.length} QR codes` : `${rows.length} / ${limit} QR codes used`}
        actions={<>{(features.bulkQr || isAdmin) && <Link href="/dashboard/qr/bulk" className="btn-secondary"><Layers size={16} />Bulk generate</Link>}{can(ws, "qr", "create") && !atLimit && <Link href="/dashboard/qr/new" className="btn-primary"><Plus size={16} />New QR code</Link>}</>} />
      {atLimit && <div className="mb-4"><Alert type="warning">You reached the QR code limit of your plan. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to create more.</Alert></div>}
      <QrList rows={list} channels={channels} canDelete={can(ws, "qr", "delete")} canEdit={can(ws, "qr", "edit")} />
    </div>
  );
}
