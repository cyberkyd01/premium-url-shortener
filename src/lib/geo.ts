import { UAParser } from "ua-parser-js";
import { sha256 } from "./utils";

export interface VisitorInfo {
  ip: string; ipHash: string; country: string | null; countryCode: string | null; region: string | null; city: string | null;
  lat: number | null; lng: number | null; browser: string | null; os: string | null; device: string;
  isBot: boolean; language: string | null; referer: string | null; refererHost: string | null; userAgent: string;
  inApp: string | null; // instagram | facebook | tiktok | twitter | linkedin | messenger | null
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|skypeuripreview|preview|embedly|quora link|pinterest|curl|wget|python-requests|go-http-client|java\/|httpclient|okhttp|headless|phantom|lighthouse|gtmetrix|pingdom|uptime|monitor/i;
const IN_APP_RE: [RegExp, string][] = [
  [/Instagram/i, "instagram"], [/FBAN|FBAV|FB_IAB/i, "facebook"], [/musical_ly|TikTok|BytedanceWebview/i, "tiktok"],
  [/Twitter/i, "twitter"], [/LinkedInApp/i, "linkedin"], [/Messenger|MessengerLite/i, "messenger"], [/Snapchat/i, "snapchat"],
];

let geoipMod: typeof import("geoip-lite") | null | undefined;
function geoip() {
  if (geoipMod === undefined) {
    try { geoipMod = require("geoip-lite"); } catch { geoipMod = null; }
  }
  return geoipMod;
}

export function clientIp(headers: Headers) {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return headers.get("cf-connecting-ip") || headers.get("x-real-ip") || "127.0.0.1";
}

export function parseVisitor(headers: Headers): VisitorInfo {
  const ip = clientIp(headers);
  const ua = headers.get("user-agent") || "";
  const parsed = new UAParser(ua).getResult();
  const type = parsed.device.type;
  const device = BOT_RE.test(ua) ? "bot" : type === "mobile" ? "mobile" : type === "tablet" ? "tablet" : "desktop";
  const geo = geoip()?.lookup(ip) ?? null;
  const cfCountry = headers.get("cf-ipcountry") || headers.get("x-vercel-ip-country");
  const referer = headers.get("referer");
  let refererHost: string | null = null;
  try { refererHost = referer ? new URL(referer).hostname.replace(/^www\./, "") : null; } catch { refererHost = null; }
  const lang = headers.get("accept-language")?.split(",")[0]?.split("-")[0]?.toLowerCase() ?? null;
  const inApp = IN_APP_RE.find(([re]) => re.test(ua))?.[1] ?? null;
  const countryCode = geo?.country || cfCountry || null;
  return {
    ip, ipHash: sha256(ip + ":" + new Date().toISOString().slice(0, 10)),
    country: countryCode ? countryName(countryCode) : null, countryCode,
    region: geo?.region || headers.get("x-vercel-ip-country-region") || null,
    city: geo?.city || headers.get("x-vercel-ip-city") || null,
    lat: geo?.ll?.[0] ?? null, lng: geo?.ll?.[1] ?? null,
    browser: parsed.browser.name ?? null, os: parsed.os.name ?? null, device,
    isBot: device === "bot", language: lang, referer, refererHost, userAgent: ua.slice(0, 500), inApp,
  };
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export function countryName(code: string) {
  try { return regionNames?.of(code.toUpperCase()) ?? code; } catch { return code; }
}

export const COUNTRIES = ["AF","AL","DZ","AR","AU","AT","BD","BE","BR","BG","CA","CL","CN","CO","HR","CZ","DK","EG","FI","FR","DE","GH","GR","HK","HU","IN","ID","IR","IQ","IE","IL","IT","JP","JO","KE","KW","MY","MX","MA","NL","NZ","NG","NO","PK","PE","PH","PL","PT","QA","RO","RU","SA","SG","ZA","KR","ES","LK","SE","CH","TW","TH","TR","UA","AE","GB","US","VN"].map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name));
