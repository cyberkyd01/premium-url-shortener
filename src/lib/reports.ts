import { db } from "./db";
import { getSettings } from "./settings";
import { sendMail } from "./mail";
import { shortUrl } from "./links";
import { countryName } from "./geo";
import { appUrl, escapeHtml, formatNumber } from "./utils";

export type ReportFrequency = "none" | "weekly" | "monthly";
export const REPORT_FREQUENCIES: ReportFrequency[] = ["none", "weekly", "monthly"];

export interface Digest {
  userId: string; days: number; from: Date; to: Date;
  totals: { clicks: number; unique: number; prevClicks: number; prevUnique: number; newLinks: number; prevNewLinks: number; bioViews: number; prevBioViews: number; qrScans: number; prevQrScans: number; conversions: number; conversionValue: number };
  topLinks: { id: string; alias: string; title: string | null; short: string; clicks: number }[];
  topCountries: { label: string; count: number }[];
  topReferrers: { label: string; count: number }[];
  brokenLinks: number;
}

function pct(cur: number, prev: number) {
  if (!prev) return cur ? "new" : "0%";
  const d = Math.round(((cur - prev) / prev) * 100);
  return (d > 0 ? "+" : "") + d + "%";
}

/** Aggregates a user's activity for the last `days` days (and the period before it for comparison). */
export async function buildDigest(userId: string, days = 7): Promise<Digest> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const prevFrom = new Date(from.getTime() - days * 86400000);
  const cur = { createdAt: { gte: from, lte: to } };
  const prev = { createdAt: { gte: prevFrom, lt: from } };
  const ownLink = { link: { userId } };
  const ownBio = { bioPage: { userId } };
  const ownQr = { qrCode: { userId } };
  const [clicks, unique, prevClicks, prevUnique, newLinks, prevNewLinks, bioViews, prevBioViews, qrScans, prevQrScans, convAgg, topRaw, countries, referrers, brokenLinks] = await Promise.all([
    db.click.count({ where: { ...cur, ...ownLink, isBot: false } }),
    db.click.count({ where: { ...cur, ...ownLink, isBot: false, isUnique: true } }),
    db.click.count({ where: { ...prev, ...ownLink, isBot: false } }),
    db.click.count({ where: { ...prev, ...ownLink, isBot: false, isUnique: true } }),
    db.link.count({ where: { userId, ...cur } }),
    db.link.count({ where: { userId, ...prev } }),
    db.click.count({ where: { ...cur, ...ownBio, isBot: false } }),
    db.click.count({ where: { ...prev, ...ownBio, isBot: false } }),
    db.click.count({ where: { ...cur, ...ownQr } }),
    db.click.count({ where: { ...prev, ...ownQr } }),
    db.conversion.aggregate({ where: { ...cur, ...ownLink }, _count: { _all: true }, _sum: { value: true } }),
    db.click.groupBy({ by: ["linkId"], where: { ...cur, ...ownLink, isBot: false, linkId: { not: null } }, _count: { _all: true }, orderBy: { _count: { linkId: "desc" } }, take: 10 }),
    db.click.groupBy({ by: ["countryCode"], where: { ...cur, ...ownLink, isBot: false }, _count: { _all: true }, orderBy: { _count: { countryCode: "desc" } }, take: 5 }),
    db.click.groupBy({ by: ["refererHost"], where: { ...cur, ...ownLink, isBot: false }, _count: { _all: true }, orderBy: { _count: { refererHost: "desc" } }, take: 5 }),
    db.link.count({ where: { userId, healthStatus: "broken", isArchived: false } }),
  ]);
  const ids = topRaw.map((t) => t.linkId).filter((x): x is string => !!x);
  const links = ids.length ? await db.link.findMany({ where: { id: { in: ids } }, include: { domain: true } }) : [];
  const topLinks = topRaw.flatMap((t) => {
    const l = links.find((x) => x.id === t.linkId);
    return l ? [{ id: l.id, alias: l.alias, title: l.title, short: shortUrl(l), clicks: t._count._all }] : [];
  });
  return {
    userId, days, from, to,
    totals: { clicks, unique, prevClicks, prevUnique, newLinks, prevNewLinks, bioViews, prevBioViews, qrScans, prevQrScans, conversions: convAgg._count._all, conversionValue: convAgg._sum.value ?? 0 },
    topLinks,
    topCountries: countries.map((c) => ({ label: c.countryCode ? countryName(c.countryCode) : "Unknown", count: c._count._all })),
    topReferrers: referrers.map((r) => ({ label: r.refererHost ?? "Direct / unknown", count: r._count._all })),
    brokenLinks,
  };
}

/** Renders the digest as a self-contained HTML email. */
export function renderDigestHtml(d: Digest, opts: { siteName: string; logo?: string; username: string; frequency: ReportFrequency }) {
  const t = d.totals;
  const period = opts.frequency === "monthly" ? "month" : "week";
  const stat = (label: string, value: string, delta: string) => `<td style="padding:12px;background:#f8fafc;border-radius:10px;text-align:center;width:25%"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="font-size:22px;font-weight:700;margin-top:4px">${value}</div><div style="font-size:12px;color:${delta.startsWith("+") || delta === "new" ? "#10b981" : delta.startsWith("-") ? "#ef4444" : "#64748b"}">${delta} vs previous ${period}</div></td>`;
  const rows = (items: { label: string; count: number }[]) => items.length ? items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(i.label)}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b">${formatNumber(i.count)}</td></tr>`).join("") : `<tr><td style="padding:6px 0;color:#94a3b8">No data</td></tr>`;
  const linksRows = d.topLinks.length ? d.topLinks.map((l, i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0"><span style="color:#94a3b8;margin-right:8px">${i + 1}.</span><a href="${appUrl(`/dashboard/links/${l.id}`)}" style="color:#6366f1;text-decoration:none;font-weight:600">${escapeHtml(l.title || "/" + l.alias)}</a><div style="font-size:12px;color:#64748b">${escapeHtml(l.short)}</div></td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${formatNumber(l.clicks)}</td></tr>`).join("") : `<tr><td style="padding:8px 0;color:#94a3b8">No clicks in this period.</td></tr>`;
  const range = `${d.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${d.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;padding:32px;max-width:100%">
<tr><td style="padding-bottom:20px">${opts.logo ? `<img src="${escapeHtml(opts.logo)}" alt="${escapeHtml(opts.siteName)}" style="height:32px"/>` : `<span style="font-size:20px;font-weight:800">${escapeHtml(opts.siteName)}</span>`}</td></tr>
<tr><td style="font-size:22px;font-weight:700">Your ${opts.frequency === "monthly" ? "monthly" : "weekly"} report</td></tr>
<tr><td style="color:#64748b;font-size:14px;padding-bottom:20px">Hi ${escapeHtml(opts.username)}, here is what happened between ${range}.</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="6"><tr>${stat("Clicks", formatNumber(t.clicks), pct(t.clicks, t.prevClicks))}${stat("Unique", formatNumber(t.unique), pct(t.unique, t.prevUnique))}${stat("New links", formatNumber(t.newLinks), pct(t.newLinks, t.prevNewLinks))}${stat("Bio views", formatNumber(t.bioViews), pct(t.bioViews, t.prevBioViews))}</tr></table></td></tr>
<tr><td style="padding-top:6px"><table width="100%" cellpadding="0" cellspacing="6"><tr>${stat("QR scans", formatNumber(t.qrScans), pct(t.qrScans, t.prevQrScans))}${stat("Conversions", formatNumber(t.conversions), t.conversionValue ? "$" + t.conversionValue.toFixed(2) + " value" : "—")}<td style="width:50%"></td></tr></table></td></tr>
${d.brokenLinks ? `<tr><td style="padding-top:16px"><div style="background:#fef3c7;color:#92400e;border-radius:10px;padding:12px 14px;font-size:13px">${d.brokenLinks} of your links currently point to a broken destination. <a href="${appUrl("/dashboard/health")}" style="color:#92400e;font-weight:600">Review link health</a></div></td></tr>` : ""}
<tr><td style="padding-top:24px;font-size:15px;font-weight:700">Top links</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${linksRows}</table></td></tr>
<tr><td style="padding-top:24px"><table width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="width:50%;padding-right:12px"><div style="font-size:15px;font-weight:700;margin-bottom:6px">Top countries</div><table width="100%" style="font-size:13px">${rows(d.topCountries)}</table></td>
<td valign="top" style="width:50%;padding-left:12px"><div style="font-size:15px;font-weight:700;margin-bottom:6px">Top referrers</div><table width="100%" style="font-size:13px">${rows(d.topReferrers)}</table></td>
</tr></table></td></tr>
<tr><td style="padding-top:28px" align="center"><a href="${appUrl("/dashboard")}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">Open your dashboard</a></td></tr>
<tr><td style="font-size:12px;color:#94a3b8;padding-top:24px;text-align:center">You receive this ${opts.frequency} digest because reports are enabled in your <a href="${appUrl("/dashboard/reports")}" style="color:#64748b">report settings</a>.<br/>&copy; ${new Date().getFullYear()} ${escapeHtml(opts.siteName)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Builds and emails the digest to one user, stamping `reportSentAt`. */
export async function sendDigest(userId: string, frequency: Exclude<ReportFrequency, "none">) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, username: true, name: true, status: true } });
  if (!user || user.status !== 1) return false;
  const s = await getSettings();
  const days = frequency === "monthly" ? 30 : 7;
  const digest = await buildDigest(userId, days);
  const html = renderDigestHtml(digest, { siteName: s["site.name"], logo: s["site.logo"] ? (s["site.logo"].startsWith("http") ? s["site.logo"] : appUrl(s["site.logo"])) : undefined, username: user.name || user.username, frequency });
  const ok = await sendMail({ to: user.email, subject: `[${s["site.name"]}] Your ${frequency} report: ${formatNumber(digest.totals.clicks)} clicks`, html });
  if (ok) await db.user.update({ where: { id: userId }, data: { reportSentAt: new Date() } });
  return ok;
}

/** True when a digest is due today for this frequency and hasn't been sent within the period. */
export function digestDue(frequency: string, reportSentAt: Date | null, now = new Date()) {
  if (frequency === "weekly") return now.getDay() === 1 && (!reportSentAt || now.getTime() - reportSentAt.getTime() > 6 * 86400000);
  if (frequency === "monthly") return now.getDate() === 1 && (!reportSentAt || now.getTime() - reportSentAt.getTime() > 27 * 86400000);
  return false;
}
