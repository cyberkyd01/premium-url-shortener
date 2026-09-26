import { db } from "./db";
import { getSettings } from "./settings";
import { randomAlias, slugify } from "./utils";

/** Alias availability across every resource that shares the root namespace: links, bio pages, QR aliases, campaign rotators, pages and usernames. */
export async function globalAliasAvailable(alias: string, domainId: string | null, exclude: { bioId?: string; linkId?: string; qrId?: string } = {}) {
  const s = await getSettings();
  const lower = alias.toLowerCase();
  if ((s["links.reservedAliases"] || "").split(",").map((r) => r.trim().toLowerCase()).includes(lower)) return false;
  if (await db.blockedItem.findFirst({ where: { type: "alias", value: lower }, select: { id: true } })) return false;
  if (await db.link.findFirst({ where: { alias, domainId, ...(exclude.linkId ? { NOT: { id: exclude.linkId } } : {}) }, select: { id: true } })) return false;
  if (await db.bioPage.findFirst({ where: { alias, domainId, ...(exclude.bioId ? { NOT: { id: exclude.bioId } } : {}) }, select: { id: true } })) return false;
  if (!domainId) {
    if (await db.page.findUnique({ where: { slug: alias }, select: { id: true } })) return false;
    if (await db.user.findUnique({ where: { username: alias }, select: { id: true } })) return false;
    const qr = await db.qrCode.findUnique({ where: { alias }, select: { id: true } });
    if (qr && qr.id !== exclude.qrId) return false;
    if (await db.campaign.findUnique({ where: { rotatorAlias: alias }, select: { id: true } })) return false;
  }
  return true;
}

/** Generates a free alias, optionally derived from a base string. */
export async function generateFreeAlias(base?: string, length = 6) {
  const b = base ? slugify(base).replace(/-/g, "").slice(0, 30) : "";
  for (let i = 0; i < 20; i++) {
    const a = b && i === 0 ? b : b ? `${b}${randomAlias(3).toLowerCase()}` : randomAlias(length + (i > 10 ? 1 : 0));
    if (a && (await globalAliasAvailable(a, null))) return a;
  }
  return randomAlias(length + 3);
}
