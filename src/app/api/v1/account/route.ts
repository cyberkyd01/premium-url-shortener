import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk } from "@/lib/api-auth";
import { authenticate, apiHandler, asString, corsPreflight, readBody, ApiRequestError  } from "@/lib/api-helpers";
import { serializeSubscription, serializeUser } from "@/lib/api-serializers";
import { withinLimit, type LimitKey } from "@/lib/plan";

export const dynamic = "force-dynamic";

const LIMIT_KEYS: LimitKey[] = ["limitLinks", "limitLinksMonthly", "limitBioPages", "limitQrCodes", "limitQrMonthly", "limitDomains", "limitCampaigns", "limitPixels", "limitSplash", "limitOverlays", "limitTeamMembers", "limitApiKeys", "limitAiCredits"];

export const OPTIONS = () => corsPreflight();

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "account.read");
  if ("error" in auth) return auth.error;
  const { user, plan, features } = auth;
  const usage: Record<string, { limit: number; used: number }> = {};
  for (const key of LIMIT_KEYS) {
    const r = await withinLimit(user.id, key);
    usage[key.replace(/^limit/, "").replace(/^[A-Z]/, (c) => c.toLowerCase())] = { limit: r.limit, used: r.used };
  }
  const [subscription, apiKeys, webhooks] = await Promise.all([
    db.subscription.findFirst({ where: { userId: user.id, status: { in: ["active", "trialing", "past_due"] } }, orderBy: { createdAt: "desc" }, include: { plan: true } }),
    db.apiKey.count({ where: { userId: user.id, active: true } }),
    db.webhook.count({ where: { userId: user.id, active: true } }),
  ]);
  return apiOk({
    data: {
      ...serializeUser(user),
      plan: plan ? { id: plan.id, name: plan.name, slug: plan.slug, isFree: plan.isFree, expires: user.planExpires?.toISOString() ?? null, trialEnds: user.planTrialEnds?.toISOString() ?? null } : null,
      subscription: subscription ? serializeSubscription(subscription) : null,
      limits: usage, features, apiKeys, webhooks,
    },
  });
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req, "account.write");
  if ("error" in auth) return auth.error;
  const body = await readBody(req);
  const data: { name?: string | null; avatar?: string | null; timezone?: string; language?: string } = {};
  if ("name" in body) data.name = asString(body.name)?.slice(0, 100) || null;
  if ("avatar" in body) {
    const a = asString(body.avatar) || null;
    if (a && !/^(https?:\/\/|\/)/.test(a)) throw new ApiRequestError("Avatar must be a URL");
    data.avatar = a;
  }
  const tz = asString(body.timezone);
  if (tz) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { throw new ApiRequestError("Invalid timezone"); }
    data.timezone = tz;
  }
  const lang = asString(body.language);
  if (lang) data.language = lang.slice(0, 8);
  const updated = await db.user.update({ where: { id: auth.user.id }, data, include: { plan: true } });
  return apiOk({ data: serializeUser(updated) });
});
