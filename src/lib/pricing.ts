import type { Plan } from "@prisma/client";
import { planFeatures, type PlanFeatures } from "./plan";
import type { PricingPlan } from "@/components/public/pricing-grid";

const LIMITS: { key: keyof Plan; label: string; skipZero?: boolean }[] = [
  { key: "limitLinks", label: "Links" },
  { key: "limitLinksMonthly", label: "Links / month" },
  { key: "limitClicks", label: "Tracked clicks" },
  { key: "limitBioPages", label: "Bio pages", skipZero: true },
  { key: "limitQrCodes", label: "QR codes", skipZero: true },
  { key: "limitDomains", label: "Custom domains", skipZero: true },
  { key: "limitCampaigns", label: "Campaigns", skipZero: true },
  { key: "limitPixels", label: "Pixels", skipZero: true },
  { key: "limitSplash", label: "Splash pages", skipZero: true },
  { key: "limitOverlays", label: "Overlays", skipZero: true },
  { key: "limitTeamMembers", label: "Team members", skipZero: true },
  { key: "limitApiKeys", label: "API keys", skipZero: true },
  { key: "limitAiCredits", label: "AI credits / month", skipZero: true },
  { key: "limitFiles", label: "Hosted files", skipZero: true },
  { key: "limitStorageMb", label: "Storage (MB)", skipZero: true },
  { key: "limitSms", label: "SMS / month", skipZero: true },
];

const FEATURE_LABELS: [keyof PlanFeatures, string][] = [
  ["customAlias", "Custom aliases"], ["premiumAlias", "Premium short aliases"], ["password", "Password protection"], ["expiration", "Link expiration"],
  ["clickLimit", "Click limits"], ["geoTargeting", "Geo targeting"], ["deviceTargeting", "Device targeting"], ["languageTargeting", "Language targeting"],
  ["timeTargeting", "Time targeting"], ["conditions", "Advanced targeting rules"], ["abTesting", "A/B testing & rotator"], ["deepLinks", "Deep links"],
  ["utm", "UTM builder"], ["customParams", "Custom parameters"], ["parameterTemplates", "Parameter templates"], ["customSplash", "Custom splash pages"],
  ["overlays", "Overlays & CTA"], ["pixels", "Retargeting pixels"], ["metaTags", "Custom meta tags"], ["cloaking", "Link cloaking"], ["botBlock", "Bot blocking"],
  ["inAppBreakout", "In-app browser breakout"], ["advancedQr", "Advanced QR styling"], ["bulkQr", "Bulk QR codes"], ["dynamicQr", "Dynamic QR codes"],
  ["bioTemplates", "Bio page templates"], ["bioCustomDomain", "Bio pages on custom domains"], ["customCss", "Custom CSS"], ["customLogo", "Custom logo"],
  ["noAds", "No advertisements"], ["noBranding", "Remove branding"], ["api", "API access"], ["webhooks", "Webhooks & Zapier"], ["slack", "Slack integration"],
  ["teams", "Teams"], ["aiCopilot", "AI copilot"], ["import", "Bulk import"], ["export", "Data export"], ["publicStats", "Public stats pages"],
];

function limitLabel(v: number) {
  return v === -1 ? "Unlimited" : String(v);
}

/** Converts a Plan row to the presentational structure used by the pricing grid. */
export function toPricingPlan(plan: Plan): PricingPlan {
  const f = planFeatures(plan);
  const limits = LIMITS.flatMap(({ key, label, skipZero }) => {
    const v = plan[key];
    if (typeof v !== "number") return [];
    if (skipZero && v === 0) return [];
    return [{ label, value: limitLabel(v) }];
  });
  const features = FEATURE_LABELS.map(([key, label]) => ({ label, included: !!f[key] }));
  features.push({ label: `${f.redirectTypes.length} redirect type${f.redirectTypes.length === 1 ? "" : "s"}`, included: true });
  features.push({ label: `${f.statsRetentionDays} days of statistics`, included: true });
  return {
    id: plan.id, name: plan.name, description: plan.description, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, priceLifetime: plan.priceLifetime,
    isFree: plan.isFree, isFeatured: plan.isFeatured, trialDays: plan.trialDays, limits, features,
  };
}
