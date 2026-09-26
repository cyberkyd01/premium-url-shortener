import type { PlanFeatures } from "@/lib/plan";

export const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  customAlias: "Custom aliases", password: "Password protection", expiration: "Link expiration", geoTargeting: "Geo targeting", deviceTargeting: "Device targeting",
  languageTargeting: "Language targeting", timeTargeting: "Time targeting", conditions: "Advanced conditions", abTesting: "A/B testing", deepLinks: "Deep links",
  utm: "UTM builder", customParams: "Custom parameters", parameterTemplates: "Parameter templates", customSplash: "Custom splash pages", redirectTypes: "Redirect types",
  premiumAlias: "Premium (short) aliases", noAds: "No ads", noBranding: "Remove branding", api: "API access", import: "Import links", export: "Export data",
  customCss: "Custom CSS", customLogo: "Custom logo", bioTemplates: "Bio templates", bioCustomDomain: "Bio on custom domain", advancedQr: "Advanced QR styling",
  bulkQr: "Bulk QR generation", dynamicQr: "Dynamic QR codes", clickLimit: "Click limits", cloaking: "Link cloaking", botBlock: "Bot blocking", inAppBreakout: "In-app browser breakout",
  webhooks: "Webhooks / Zapier", slack: "Slack integration", aiCopilot: "AI Copilot", teams: "Teams", metaTags: "Custom meta tags", publicStats: "Public statistics",
  statsRetentionDays: "Stats retention (days)", overlays: "Overlays", pixels: "Retargeting pixels", archive: "Archive links", qrTypes: "QR code types",
};

export const LIMIT_FIELDS: { key: string; label: string }[] = [
  { key: "limitLinks", label: "Links (total)" }, { key: "limitLinksMonthly", label: "Links per month" }, { key: "limitClicks", label: "Clicks tracked" },
  { key: "limitBioPages", label: "Bio pages" }, { key: "limitQrCodes", label: "QR codes (total)" }, { key: "limitQrMonthly", label: "QR codes per month" },
  { key: "limitDomains", label: "Custom domains" }, { key: "limitCampaigns", label: "Campaigns" }, { key: "limitPixels", label: "Pixels" },
  { key: "limitSplash", label: "Splash pages" }, { key: "limitOverlays", label: "Overlays" }, { key: "limitTeamMembers", label: "Team members" },
  { key: "limitApiKeys", label: "API keys" }, { key: "limitAiCredits", label: "AI credits / month" }, { key: "limitCoupons", label: "Coupons (bio)" },
  { key: "limitChannels", label: "Channels" }, { key: "limitFiles", label: "Hosted files" }, { key: "limitStorageMb", label: "Storage (MB)" }, { key: "limitSms", label: "SMS / month" },
];

export const GATEWAY_ID_FIELDS: { key: string; label: string }[] = [
  { key: "stripeProductId", label: "Stripe product" }, { key: "stripePriceMonthly", label: "Stripe price (monthly)" }, { key: "stripePriceYearly", label: "Stripe price (yearly)" },
  { key: "paypalPlanMonthly", label: "PayPal plan (monthly)" }, { key: "paypalPlanYearly", label: "PayPal plan (yearly)" },
  { key: "paddlePriceMonthly", label: "Paddle price (monthly)" }, { key: "paddlePriceYearly", label: "Paddle price (yearly)" },
  { key: "paystackPlanMonthly", label: "Paystack plan (monthly)" }, { key: "paystackPlanYearly", label: "Paystack plan (yearly)" },
];
