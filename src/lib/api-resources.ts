import { db } from "./db";
import { ApiRequestError } from "./api-helpers";

/** Ownership-checked loaders shared by the v1 resource routes. Admins may access any record. */
export async function loadCampaign(id: string, userId: string, isAdmin: boolean) {
  const c = await db.campaign.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { _count: { select: { links: true } } } });
  if (!c || (!isAdmin && c.userId !== userId)) throw new ApiRequestError("Campaign not found", 404);
  return c;
}

export async function loadChannel(id: string, userId: string, isAdmin: boolean) {
  const c = await db.channel.findUnique({ where: { id }, include: { _count: { select: { links: true, bioPages: true, qrCodes: true } } } });
  if (!c || (!isAdmin && c.userId !== userId)) throw new ApiRequestError("Channel not found", 404);
  return c;
}

export async function loadPixel(id: string, userId: string, isAdmin: boolean) {
  const p = await db.pixel.findUnique({ where: { id }, include: { _count: { select: { links: true } } } });
  if (!p || (!isAdmin && p.userId !== userId)) throw new ApiRequestError("Pixel not found", 404);
  return p;
}

export async function loadDomain(id: string, userId: string, isAdmin: boolean) {
  const d = await db.domain.findFirst({ where: { OR: [{ id }, { domain: id.toLowerCase() }] }, include: { _count: { select: { links: true } } } });
  if (!d || (!isAdmin && d.userId !== userId)) throw new ApiRequestError("Domain not found", 404);
  return d;
}

export async function loadQr(id: string, userId: string, isAdmin: boolean) {
  const q = await db.qrCode.findFirst({ where: { OR: [{ id }, { alias: id }] }, include: { link: { include: { domain: true } } } });
  if (!q || (!isAdmin && q.userId !== userId)) throw new ApiRequestError("QR code not found", 404);
  return q;
}

export async function loadBio(id: string, userId: string, isAdmin: boolean, withBlocks = true) {
  const b = await db.bioPage.findFirst({
    where: { OR: [{ id }, { alias: id, ...(isAdmin ? {} : { userId }) }] },
    include: { domain: true, blocks: withBlocks ? { orderBy: { order: "asc" as const } } : false, _count: { select: { blocks: true } } },
  });
  if (!b || (!isAdmin && b.userId !== userId)) throw new ApiRequestError("Bio page not found", 404);
  return b;
}

export async function loadBioBlock(bioPageId: string, blockId: string) {
  const block = await db.bioBlock.findFirst({ where: { id: blockId, bioPageId } });
  if (!block) throw new ApiRequestError("Block not found", 404);
  return block;
}

export async function loadFile(id: string, userId: string, isAdmin: boolean) {
  const f = await db.hostedFile.findFirst({ where: { OR: [{ id }, { alias: id }] } });
  if (!f || (!isAdmin && f.userId !== userId)) throw new ApiRequestError("File not found", 404);
  return f;
}
