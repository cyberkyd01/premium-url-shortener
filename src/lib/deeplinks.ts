/** Automatic deep link conversion for popular apps (Airbnb, AliExpress, Amazon, Apple Music, Facebook, GrubHub, Instagram,
 *  LinkedIn, Messenger, Netflix, Pinterest, Snapchat, Spotify, Telegram, TikTok, Twitch, X, Walmart, WhatsApp, Wolt, Yelp, YouTube, Zoom). */
export interface DeepLink { ios?: string; android?: string; app: string }

const RULES: { app: string; host: RegExp; ios: (u: URL) => string; android?: (u: URL) => string }[] = [
  { app: "youtube", host: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, ios: (u) => `youtube://${u.host}${u.pathname}${u.search}`, android: (u) => `vnd.youtube:${u.href}` },
  { app: "instagram", host: /(^|\.)instagram\.com$/, ios: (u) => { const m = u.pathname.match(/^\/(p|reel)\/([^/]+)/); return m ? `instagram://media?id=${m[2]}` : `instagram://user?username=${u.pathname.split("/")[1]}`; } },
  { app: "tiktok", host: /(^|\.)tiktok\.com$/, ios: (u) => `snssdk1233://${u.host}${u.pathname}` },
  { app: "twitter", host: /(^|\.)(twitter|x)\.com$/, ios: (u) => { const m = u.pathname.match(/status\/(\d+)/); return m ? `twitter://status?id=${m[1]}` : `twitter://user?screen_name=${u.pathname.split("/")[1]}`; } },
  { app: "facebook", host: /(^|\.)facebook\.com$/, ios: (u) => `fb://facewebmodal/f?href=${encodeURIComponent(u.href)}` },
  { app: "messenger", host: /(^|\.)m\.me$/, ios: (u) => `fb-messenger://user-thread/${u.pathname.slice(1)}` },
  { app: "linkedin", host: /(^|\.)linkedin\.com$/, ios: (u) => `linkedin://${u.pathname.slice(1)}` },
  { app: "pinterest", host: /(^|\.)pinterest\.(com|[a-z]{2})$/, ios: (u) => `pinterest://${u.pathname.slice(1)}` },
  { app: "snapchat", host: /(^|\.)snapchat\.com$/, ios: (u) => `snapchat://add/${u.pathname.split("/").pop()}` },
  { app: "spotify", host: /(^|\.)spotify\.com$/, ios: (u) => `spotify:${u.pathname.slice(1).replace(/\//g, ":")}` },
  { app: "applemusic", host: /(^|\.)music\.apple\.com$/, ios: (u) => u.href.replace("https://", "music://") },
  { app: "telegram", host: /(^|\.)(t\.me|telegram\.me)$/, ios: (u) => `tg://resolve?domain=${u.pathname.slice(1)}` },
  { app: "whatsapp", host: /(^|\.)(wa\.me|whatsapp\.com)$/, ios: (u) => `whatsapp://send?phone=${u.pathname.slice(1)}${u.search ? "&" + u.search.slice(1) : ""}` },
  { app: "twitch", host: /(^|\.)twitch\.tv$/, ios: (u) => `twitch://stream/${u.pathname.slice(1)}` },
  { app: "netflix", host: /(^|\.)netflix\.com$/, ios: (u) => `nflx://${u.host}${u.pathname}` },
  { app: "amazon", host: /(^|\.)amazon\.(com|[a-z.]{2,6})$/, ios: (u) => `com.amazon.mobile.shopping.web://${u.host}${u.pathname}${u.search}` },
  { app: "aliexpress", host: /(^|\.)aliexpress\.(com|[a-z]{2})$/, ios: (u) => `aliexpress://${u.host}${u.pathname}` },
  { app: "airbnb", host: /(^|\.)airbnb\.(com|[a-z.]{2,6})$/, ios: (u) => `airbnb://${u.pathname.slice(1)}` },
  { app: "yelp", host: /(^|\.)yelp\.com$/, ios: (u) => `yelp:///${u.pathname.slice(1)}` },
  { app: "walmart", host: /(^|\.)walmart\.com$/, ios: (u) => `walmart://${u.pathname.slice(1)}` },
  { app: "zoom", host: /(^|\.)zoom\.us$/, ios: (u) => { const m = u.pathname.match(/\/j\/(\d+)/); return m ? `zoomus://zoom.us/join?confno=${m[1]}${u.searchParams.get("pwd") ? "&pwd=" + u.searchParams.get("pwd") : ""}` : u.href; } },
  { app: "wolt", host: /(^|\.)wolt\.com$/, ios: (u) => `wolt://${u.pathname.slice(1)}` },
  { app: "grubhub", host: /(^|\.)grubhub\.com$/, ios: (u) => `grubhub://${u.pathname.slice(1)}` },
];

export function detectDeepLink(url: string): DeepLink | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const rule = RULES.find((r) => r.host.test(host));
    if (!rule) return null;
    const ios = rule.ios(u);
    return { app: rule.app, ios, android: rule.android ? rule.android(u) : ios };
  } catch {
    return null;
  }
}

export const DEEP_LINK_APPS = RULES.map((r) => r.app);
