import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { COUNTRIES } from "@/lib/geo";
import { appHost, json } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace";
import type { LinkFormOptions } from "./link-form";

/** Loads every select/option list the link editor needs for a workspace. */
export async function loadLinkFormOptions(ws: Workspace): Promise<LinkFormOptions> {
  const s = await getSettings();
  const { user, features } = await getUserPlan(ws.ownerId);
  const [domains, splashPages, overlays, channels, campaigns, pixels, templates] = await Promise.all([
    db.domain.findMany({ where: { status: 1, isMain: false, OR: [{ userId: ws.ownerId }, { isPublic: true }] }, orderBy: { domain: "asc" } }),
    db.splashPage.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.overlay.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.channel.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    db.campaign.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.pixel.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" }, select: { id: true, name: true, provider: true } }),
    db.parameterTemplate.findMany({ where: { userId: ws.ownerId }, orderBy: { name: "asc" } }),
  ]);
  const tagRows = await db.link.findMany({ where: { userId: ws.ownerId, NOT: { tags: "" } }, select: { tags: true }, take: 2000 });
  const tags = [...new Set(tagRows.flatMap((r) => r.tags.split(",").map((t) => t.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  return {
    domains: domains.map((d) => ({ id: d.id, domain: d.domain, isPublic: d.isPublic })),
    splashPages, overlays, channels, campaigns, pixels,
    templates: templates.map((t) => ({ id: t.id, name: t.name, params: json<Record<string, string>>(t.params, {}) })),
    countries: COUNTRIES, tags,
    features, isAdmin: user.role === "admin", aiEnabled: s["ai.enabled"] === "1" && (s["ai.features"] || "").includes("slug"),
    mainUsable: s["domains.mainUsable"] === "1", appHost: appHost(),
  };
}
