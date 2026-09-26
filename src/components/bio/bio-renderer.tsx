import type { BioBlock, BioPage } from "@prisma/client";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { appHost, appUrl, json, sha256 } from "@/lib/utils";
import { parseBioJson, type BioVisitor } from "@/lib/bio-widgets";
import { BioView } from "./bio-view";
import type { PixelRef } from "./pixels";

export function bioUnlockToken(page: Pick<BioPage, "id" | "password">) {
  return sha256(`bio:${page.id}:${page.password ?? ""}:${process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? ""}`);
}

/** Server component that renders a bio page with all site-level context (settings, plan features, pixels, gates, poll results).
 *  Used by `/[alias]`, `/u/[username]` and `/campaign/[slug]`. */
export async function BioRenderer({ page, blocks, preview, visitor }: { page: BioPage; blocks: BioBlock[]; preview?: boolean; visitor?: BioVisitor | null }) {
  const s = await getSettings();
  const { user, features } = await getUserPlan(page.userId);
  const isAdmin = user?.role === "admin";
  const parsed = parseBioJson(page);

  let pixels: PixelRef[] = [];
  if (!preview && parsed.pixelIds.length && (features.pixels || isAdmin)) {
    const rows = await db.pixel.findMany({ where: { id: { in: parsed.pixelIds }, userId: page.userId } });
    pixels = rows.map((p) => ({ provider: p.provider, pixelId: p.pixelId }));
  }

  // Poll results for poll blocks
  const pollBlocks = blocks.filter((b) => b.type === "poll");
  const pollResults: Record<string, Record<string, number>> = {};
  if (pollBlocks.length) {
    const subs = await db.bioSubmission.findMany({ where: { bioPageId: page.id, type: "poll", blockId: { in: pollBlocks.map((b) => b.id) } }, select: { blockId: true, data: true } });
    for (const sub of subs) {
      const opt = json<{ option?: string }>(sub.data, {}).option;
      if (!sub.blockId || !opt) continue;
      pollResults[sub.blockId] ??= {};
      pollResults[sub.blockId][opt] = (pollResults[sub.blockId][opt] ?? 0) + 1;
    }
  }

  let needsPassword = false;
  if (page.password && !preview) {
    const c = await cookies();
    needsPassword = c.get("bio_unlock_" + page.id)?.value !== bioUnlockToken(page);
  }

  const showAds = s["ads.enabled"] === "1" && !!s["ads.bio"] && !(features.noAds || isAdmin) && !preview;
  const hideBranding = page.hideBranding && (features.noBranding || isAdmin);
  const site = { name: s["site.name"], url: appUrl("/"), host: appHost().split(":")[0], branding: s["bio.branding"] !== "0" && !hideBranding, adsHtml: showAds ? s["ads.bio"] : null };
  const view = { ...page, hideBranding, verified: page.verified || !!user?.verified };

  return <BioView page={view} blocks={needsPassword ? [] : blocks} preview={preview} visitor={visitor} site={site} pixels={pixels} allowHtml={features.customCss || isAdmin} needsPassword={needsPassword} pollResults={pollResults} />;
}
