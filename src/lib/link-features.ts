import type { PlanFeatures } from "./plan";
import { LinkError, type LinkInput } from "./links";

/** Server-side plan feature enforcement shared by create/update actions (createLink already enforces on create). */
export function assertLinkFeatures(features: PlanFeatures, isAdmin: boolean, input: Partial<LinkInput>) {
  if (isAdmin) return;
  const need = (ok: boolean, key: keyof PlanFeatures, label: string) => {
    if (ok && !features[key]) throw new LinkError(`${label} is not available on your plan. Please upgrade.`, 402);
  };
  if (input.redirectType && !features.redirectTypes.includes(input.redirectType)) throw new LinkError("This redirection type is not available on your plan", 402);
  need(!!input.alias, "customAlias", "Custom alias");
  need(!!input.password, "password", "Password protection");
  need(!!input.expiresAt, "expiration", "Link expiration");
  need(!!input.clickLimit, "clickLimit", "Click limit");
  need(!!input.geoTargets?.length, "geoTargeting", "Geo targeting");
  need(!!input.deviceTargets?.length, "deviceTargeting", "Device targeting");
  need(!!input.langTargets?.length, "languageTargeting", "Language targeting");
  need(!!input.timeTargets?.length, "timeTargeting", "Time targeting");
  need(!!input.conditions?.length, "conditions", "Advanced targeting");
  need(!!input.abUrls?.length, "abTesting", "A/B testing");
  need(!!input.deepLink, "deepLinks", "Deep links");
  need(!!input.utm && Object.values(input.utm).some(Boolean), "utm", "UTM parameters");
  need(!!input.customParams && Object.keys(input.customParams).length > 0, "customParams", "Custom parameters");
  need(!!input.cloaking, "cloaking", "Link cloaking");
  need(!!input.botBlock, "botBlock", "Bot blocking");
  need(!!input.inAppBreakout, "inAppBreakout", "In-app browser breakout");
  need(!!input.pixelIds?.length, "pixels", "Pixels");
  need(!!input.image, "metaTags", "Custom meta tags");
  need(input.redirectType === "custom", "customSplash", "Custom splash pages");
  need(input.redirectType === "overlay", "overlays", "Overlays");
}
