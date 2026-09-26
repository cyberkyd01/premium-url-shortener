import type { QrCode } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { appUrl, json } from "@/lib/utils";
import { shortUrl } from "@/lib/links";
import { bioUrl } from "@/lib/bio-widgets";
import { ALL_QR_TYPES } from "@/lib/plan";
import type { Workspace } from "@/lib/workspace";
import type { QrStyle } from "@/lib/qr-types";
import { QrForm, type QrFormOptions } from "@/components/qr/qr-form";
import type { QrInput } from "./actions";

export async function QrFormScreen({ ws, qr }: { ws: Workspace; qr: QrCode | null }) {
  const [s, { features, user }, links, bios, channels] = await Promise.all([
    getSettings(), getUserPlan(ws.ownerId),
    db.link.findMany({ where: { userId: ws.ownerId, status: "active" }, include: { domain: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.bioPage.findMany({ where: { userId: ws.ownerId, isTemplate: false }, include: { domain: true }, orderBy: { createdAt: "desc" } }),
    db.channel.findMany({ where: { userId: ws.ownerId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const isAdmin = ws.isAdmin || user.role === "admin";
  const base = appUrl("/");
  const options: QrFormOptions = {
    links: links.map((l) => ({ id: l.id, label: `${l.title ? l.title + " – " : ""}${shortUrl(l).replace(/^https?:\/\//, "")}`, url: shortUrl(l) })),
    bios: bios.map((b) => ({ id: b.id, label: `${b.name || b.alias} – ${bioUrl(b, base).replace(/^https?:\/\//, "")}`, url: bioUrl(b, base) })),
    channels, allowedTypes: isAdmin ? ALL_QR_TYPES : features.qrTypes, advanced: (features.advancedQr || isAdmin) && s["qr.advanced"] !== "0",
    dynamicAllowed: features.dynamicQr || isAdmin, defaultLogo: s["qr.defaultLogo"], baseUrl: base.replace(/\/$/, ""), alias: qr?.alias ?? null,
  };
  const initial: QrInput = qr
    ? { name: qr.name, type: qr.type, data: json<Record<string, string>>(qr.data, {}), isDynamic: qr.isDynamic, linkId: qr.linkId, bioPageId: qr.bioPageId, channelId: qr.channelId, style: json<Partial<QrStyle>>(qr.style, {}) }
    : { name: "", type: "url", data: {}, isDynamic: features.dynamicQr || isAdmin, linkId: null, bioPageId: null, channelId: null, style: {} };
  return <QrForm id={qr?.id ?? null} initial={initial} options={options} />;
}
