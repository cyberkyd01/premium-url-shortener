import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createLink, shortUrl } from "@/lib/links";
import { LINK_INCLUDE, resolveDomainId } from "@/lib/api-links";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { verifyCaptcha } from "@/lib/captcha";
import { clientIp, parseVisitor } from "@/lib/geo";
import { apiError, apiOk, rateLimit } from "@/lib/api-auth";
import { authenticate, asString, corsPreflight, handleApiError, readBody, withCors, ApiRequestError } from "@/lib/api-helpers";
import { serializeLink } from "@/lib/api-serializers";

export const dynamic = "force-dynamic";

export const OPTIONS = () => corsPreflight();

const ANON_LIMIT_PER_MINUTE = 20;

/** Identifies the caller: an API key (Authorization/`?key=`) wins, otherwise the browser session, otherwise anonymous. */
async function identify(req: NextRequest): Promise<{ userId: string | null; isAdmin: boolean; error?: NextResponse }> {
  const hasKey = /^Bearer\s+\S+/i.test(req.headers.get("authorization") || "") || !!req.nextUrl.searchParams.get("key");
  if (hasKey) {
    const auth = await authenticate(req, "links.write");
    if ("error" in auth) return { userId: null, isAdmin: false, error: auth.error };
    return { userId: auth.user.id, isAdmin: auth.isAdmin };
  }
  const u = await currentUser();
  return { userId: u?.id ?? null, isAdmin: u?.role === "admin" };
}

async function shorten(req: NextRequest, params: Record<string, unknown>, format: "json" | "text") {
  const s = await getSettings();
  const ip = clientIp(req.headers);
  const who = await identify(req);
  if (who.error) return who.error;
  const url = asString(params.url ?? params.u ?? params.long_url)?.trim();
  if (!url) throw new ApiRequestError("Missing required parameter: url");
  if (!who.userId) {
    const rl = rateLimit("shorten:" + ip, ANON_LIMIT_PER_MINUTE);
    if (!rl.ok) return apiError("Too many requests. Please try again in a minute.", 429);
    if (s["captcha.onShorten"] === "1" && !(await verifyCaptcha(asString(params.captcha ?? params["g-recaptcha-response"] ?? params["cf-turnstile-response"] ?? params["h-captcha-response"]), ip))) {
      return apiError("Captcha verification failed", 400);
    }
  }
  const domainId = who.userId ? await resolveDomainId(params.domainId ?? params.domain, who.userId, who.isAdmin) : (asString(params.domainId) || undefined);
  const link = await createLink(who.userId, {
    url, alias: asString(params.alias ?? params.custom) || null, domainId: domainId ?? null,
    redirectType: asString(params.redirectType ?? params.type) || undefined, password: asString(params.password) || null,
    expiresAt: asString(params.expiresAt ?? params.expiry) || null, title: asString(params.title) || null,
  }, { ip, countryCode: parseVisitor(req.headers).countryCode });
  const short = shortUrl(link);
  if (format === "text") return new NextResponse(short, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  const full = await db.link.findUnique({ where: { id: link.id }, include: LINK_INCLUDE });
  return apiOk({ id: link.id, alias: link.alias, short, url: link.url, status: link.status, anonymous: !who.userId, link: full ? serializeLink(full) : undefined }, 201);
}

function formatOf(req: NextRequest, params: Record<string, unknown>) {
  const f = (asString(params.format) || req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  return f === "text" || f === "plain" ? "text" : "json";
}

/** POST /api/shorten {url, alias?, domainId?, redirectType?, password?, expiresAt?, captcha?} — session, API key or anonymous. */
export async function POST(req: NextRequest) {
  const body = await readBody(req);
  const format = formatOf(req, body);
  try {
    return withCors(await shorten(req, body, format));
  } catch (e) {
    const res = handleApiError(e);
    if (format === "text") {
      const data = (await res.clone().json().catch(() => ({ message: "Error" }))) as { message?: string };
      return withCors(new NextResponse("Error: " + (data.message ?? "failed"), { status: res.status, headers: { "content-type": "text/plain; charset=utf-8" } }));
    }
    return withCors(res);
  }
}

/** GET /api/shorten?url=&alias=&format=text|json — legacy bookmarklet style. */
export async function GET(req: NextRequest) {
  const params: Record<string, unknown> = Object.fromEntries(req.nextUrl.searchParams.entries());
  const format = formatOf(req, params);
  try {
    return withCors(await shorten(req, params, format));
  } catch (e) {
    const res = handleApiError(e);
    if (format === "text") {
      const data = (await res.clone().json().catch(() => ({ message: "Error" }))) as { message?: string };
      return withCors(new NextResponse("Error: " + (data.message ?? "failed"), { status: res.status, headers: { "content-type": "text/plain; charset=utf-8" } }));
    }
    return withCors(res);
  }
}
