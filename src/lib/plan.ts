import type { Plan, User } from "@prisma/client";
import { db } from "./db";
import { json } from "./utils";

export interface PlanFeatures {
  customAlias: boolean;
  password: boolean;
  expiration: boolean;
  geoTargeting: boolean;
  deviceTargeting: boolean;
  languageTargeting: boolean;
  timeTargeting: boolean;
  conditions: boolean;
  abTesting: boolean;
  deepLinks: boolean;
  utm: boolean;
  customParams: boolean;
  parameterTemplates: boolean;
  customSplash: boolean;
  redirectTypes: string[];
  premiumAlias: boolean;
  noAds: boolean;
  noBranding: boolean;
  api: boolean;
  import: boolean;
  export: boolean;
  customCss: boolean;
  customLogo: boolean;
  bioTemplates: boolean;
  bioCustomDomain: boolean;
  advancedQr: boolean;
  bulkQr: boolean;
  dynamicQr: boolean;
  clickLimit: boolean;
  cloaking: boolean;
  botBlock: boolean;
  inAppBreakout: boolean;
  webhooks: boolean;
  slack: boolean;
  aiCopilot: boolean;
  teams: boolean;
  metaTags: boolean;
  publicStats: boolean;
  statsRetentionDays: number;
  overlays: boolean;
  pixels: boolean;
  archive: boolean;
  qrTypes: string[];
}

export const ALL_REDIRECT_TYPES = ["direct", "frame", "splash", "custom", "overlay"];
export const ALL_QR_TYPES = ["url", "text", "email", "phone", "sms", "wifi", "vcard", "location", "event", "app", "crypto", "whatsapp", "paypal", "link", "bio"];

export const DEFAULT_FEATURES: PlanFeatures = {
  customAlias: true, password: false, expiration: false, geoTargeting: false, deviceTargeting: false,
  languageTargeting: false, timeTargeting: false, conditions: false, abTesting: false, deepLinks: false,
  utm: true, customParams: false, parameterTemplates: false, customSplash: false,
  redirectTypes: ["direct", "frame", "splash"], premiumAlias: false, noAds: false, noBranding: false,
  api: false, import: false, export: false, customCss: false, customLogo: false, bioTemplates: false,
  bioCustomDomain: false, advancedQr: false, bulkQr: false, dynamicQr: true, clickLimit: false,
  cloaking: false, botBlock: false, inAppBreakout: false, webhooks: false, slack: false, aiCopilot: false,
  teams: false, metaTags: false, publicStats: true, statsRetentionDays: 30, overlays: false, pixels: false,
  archive: true, qrTypes: ["url", "text", "email", "phone", "sms", "wifi", "vcard", "location"],
};

export const PRO_FEATURES: PlanFeatures = Object.fromEntries(
  Object.entries(DEFAULT_FEATURES).map(([k, v]) => [k, typeof v === "boolean" ? true : v]),
) as unknown as PlanFeatures;
PRO_FEATURES.redirectTypes = ALL_REDIRECT_TYPES;
PRO_FEATURES.qrTypes = ALL_QR_TYPES;
PRO_FEATURES.statsRetentionDays = 365;

export function planFeatures(plan?: Plan | null): PlanFeatures {
  return { ...DEFAULT_FEATURES, ...json<Partial<PlanFeatures>>(plan?.features, {}) };
}

export type UserWithPlan = User & { plan: Plan | null };

export async function getUserPlan(userId: string): Promise<{ user: UserWithPlan; plan: Plan | null; features: PlanFeatures }> {
  const user = (await db.user.findUnique({ where: { id: userId }, include: { plan: true } })) as UserWithPlan;
  let plan = user?.plan ?? null;
  if (plan && user.planExpires && user.planExpires < new Date() && !plan.isFree) {
    // Expired: fall back to free plan
    plan = await db.plan.findFirst({ where: { isFree: true } });
  }
  if (!plan) plan = await db.plan.findFirst({ where: { isFree: true } });
  return { user, plan, features: planFeatures(plan) };
}

export function isAdminUser(user?: { role?: string | null } | null) {
  return user?.role === "admin";
}

export type LimitKey =
  | "limitLinks" | "limitLinksMonthly" | "limitBioPages" | "limitQrCodes" | "limitQrMonthly" | "limitDomains"
  | "limitCampaigns" | "limitPixels" | "limitSplash" | "limitOverlays" | "limitTeamMembers" | "limitApiKeys" | "limitAiCredits";

export function limitOf(plan: Plan | null, key: LimitKey): number {
  if (!plan) return 0;
  return (plan as unknown as Record<string, number>)[key] ?? -1;
}

/** Returns true when the user may create one more of the given resource. */
export async function withinLimit(userId: string, key: LimitKey): Promise<{ ok: boolean; limit: number; used: number }> {
  const { plan, user } = await getUserPlan(userId);
  if (user.role === "admin") return { ok: true, limit: -1, used: 0 };
  const limit = limitOf(plan, key);
  if (limit === -1) return { ok: true, limit, used: 0 };
  let used = 0;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  switch (key) {
    case "limitLinks": used = await db.link.count({ where: { userId } }); break;
    case "limitLinksMonthly": used = await db.link.count({ where: { userId, createdAt: { gte: monthStart } } }); break;
    case "limitBioPages": used = await db.bioPage.count({ where: { userId } }); break;
    case "limitQrCodes": used = await db.qrCode.count({ where: { userId } }); break;
    case "limitQrMonthly": used = await db.qrCode.count({ where: { userId, createdAt: { gte: monthStart } } }); break;
    case "limitDomains": used = await db.domain.count({ where: { userId } }); break;
    case "limitCampaigns": used = await db.campaign.count({ where: { userId } }); break;
    case "limitPixels": used = await db.pixel.count({ where: { userId } }); break;
    case "limitSplash": used = await db.splashPage.count({ where: { userId } }); break;
    case "limitOverlays": used = await db.overlay.count({ where: { userId } }); break;
    case "limitTeamMembers": used = await db.teamMember.count({ where: { team: { ownerId: userId } } }); break;
    case "limitApiKeys": used = await db.apiKey.count({ where: { userId } }); break;
    case "limitAiCredits": used = user.aiCredits; break;
  }
  return { ok: used < limit, limit, used };
}
