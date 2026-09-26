import { parse as parseCsv } from "csv-parse/sync";
import { db } from "./db";
import { createLink, LinkError, normalizeTags } from "./links";
import { logActivity } from "./activity";
import { isValidAlias, isValidUrl, normalizeUrl } from "./utils";

export type MigrationSource = "bitly" | "rebrandly" | "csv";
export const MAX_BATCH = 500;

export interface ImportRow { url: string; alias?: string | null; title?: string | null; clicks?: number; tags?: string[]; createdAt?: string | null }
export interface MigrationOptions { teamId?: string | null; domainId?: string | null; keepAliases?: boolean; tag?: string | null; ip?: string }
export interface MigrationResult { jobId: string; total: number; imported: number; skipped: number; log: { row: number; alias?: string; url: string; status: "imported" | "skipped"; error?: string }[] }

class MigrationError extends Error {}

async function fetchJson<T>(url: string, init: RequestInit, label: string): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    if (r.status === 401 || r.status === 403) throw new MigrationError(`${label}: the access token was rejected (HTTP ${r.status}).`);
    if (r.status === 429) throw new MigrationError(`${label}: rate limited, please try again in a minute.`);
    if (!r.ok) throw new MigrationError(`${label}: request failed with HTTP ${r.status}.`);
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof MigrationError) throw e;
    throw new MigrationError(`${label}: ${e instanceof Error ? e.message : "network error"}`);
  } finally { clearTimeout(t); }
}

function pathAlias(shortUrl: string | undefined | null) {
  if (!shortUrl) return null;
  try { const p = new URL(/^https?:/i.test(shortUrl) ? shortUrl : "https://" + shortUrl).pathname.replace(/^\/+|\/+$/g, ""); return p && !p.includes("/") ? p : null; } catch { return null; }
}

// ------------------------------------------------------------------ Bitly (API v4)
interface BitlyLink { id: string; link: string; long_url: string; title?: string; custom_bitlinks?: string[]; created_at?: string; tags?: string[] }

/** Lists bitlinks across all groups of the token owner (max `limit`), including total click counts. */
export async function fetchBitlyLinks(token: string, limit = MAX_BATCH): Promise<ImportRow[]> {
  const headers = { authorization: `Bearer ${token.trim()}`, accept: "application/json" };
  const base = "https://api-ssl.bitly.com/v4";
  const groups = await fetchJson<{ groups: { guid: string }[] }>(`${base}/groups`, { headers }, "Bitly");
  const rows: (ImportRow & { bitlink: string })[] = [];
  for (const g of groups.groups ?? []) {
    let page = 1;
    while (rows.length < limit) {
      const d = await fetchJson<{ links: BitlyLink[]; pagination?: { next?: string; page?: number; total?: number } }>(`${base}/groups/${g.guid}/bitlinks?size=100&page=${page}`, { headers }, "Bitly");
      for (const l of d.links ?? []) {
        const custom = pathAlias(l.custom_bitlinks?.[0]);
        const auto = pathAlias(l.link);
        rows.push({ url: l.long_url, alias: custom ?? auto, title: l.title || null, createdAt: l.created_at ?? null, tags: l.tags ?? [], bitlink: (l.custom_bitlinks?.[0] ?? l.id).replace(/^https?:\/\//, "") });
        if (rows.length >= limit) break;
      }
      if (!d.pagination?.next || !(d.links ?? []).length) break;
      page++;
    }
    if (rows.length >= limit) break;
  }
  // Historic click totals (one request per link, sequential in small groups to respect rate limits).
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (r) => {
      try {
        const c = await fetchJson<{ total_clicks?: number }>(`${base}/bitlinks/${encodeURIComponent(r.bitlink)}/clicks/summary?unit=day&units=-1`, { headers }, "Bitly");
        r.clicks = c.total_clicks ?? 0;
      } catch { r.clicks = 0; }
    }));
  }
  return rows.map(({ bitlink: _b, ...r }) => r);
}

// ------------------------------------------------------------------ Rebrandly (API v1)
interface RebrandlyLink { id: string; title?: string; slashtag?: string; destination: string; shortUrl?: string; clicks?: number; createdAt?: string; tags?: { name: string }[] }

export async function fetchRebrandlyLinks(apiKey: string, limit = MAX_BATCH): Promise<ImportRow[]> {
  const headers = { apikey: apiKey.trim(), accept: "application/json" };
  const rows: ImportRow[] = [];
  let last: string | undefined;
  while (rows.length < limit) {
    const q = new URLSearchParams({ limit: "25", orderBy: "createdAt", orderDir: "desc" });
    if (last) q.set("last", last);
    const d = await fetchJson<RebrandlyLink[]>(`https://api.rebrandly.com/v1/links?${q}`, { headers }, "Rebrandly");
    if (!Array.isArray(d) || !d.length) break;
    for (const l of d) {
      rows.push({ url: l.destination, alias: l.slashtag || pathAlias(l.shortUrl), title: l.title || null, clicks: l.clicks ?? 0, createdAt: l.createdAt ?? null, tags: (l.tags ?? []).map((t) => t.name) });
      if (rows.length >= limit) break;
    }
    last = d[d.length - 1]?.id;
    if (d.length < 25) break;
  }
  return rows;
}

// ------------------------------------------------------------------ CSV exports (Bitly / TinyURL / Rebrandly / Short.io / generic)
const URL_COLS = ["long_url", "long url", "longurl", "destination", "destination url", "original", "original url", "original_url", "target", "target url", "url", "link"];
const ALIAS_COLS = ["keyword", "slashtag", "alias", "custom back-half", "back-half", "back_half", "custom_bitlink", "path", "short path", "slug"];
const SHORT_COLS = ["short url", "short_url", "shorturl", "bitlink", "short link", "short_link", "tiny url", "tinyurl"];
const TITLE_COLS = ["title", "name", "link title"];
const CLICK_COLS = ["clicks", "total clicks", "total_clicks", "click count", "engagements", "visits", "hits"];
const TAG_COLS = ["tags", "tag", "labels"];
const DATE_COLS = ["created", "created_at", "createdat", "created at", "date", "creation date"];

function findCol(headers: string[], candidates: string[]) {
  for (const c of candidates) { const i = headers.indexOf(c); if (i >= 0) return i; }
  return -1;
}

/** Parses a CSV export and auto-detects the relevant columns. Returns rows + the detected mapping for display. */
export function parseCsvExport(text: string, limit = MAX_BATCH): { rows: ImportRow[]; mapping: Record<string, string | null>; skipped: number } {
  const records = parseCsv(text.replace(/^﻿/, ""), { skip_empty_lines: true, relax_column_count: true, trim: true, bom: true }) as string[][];
  if (!records.length) return { rows: [], mapping: {}, skipped: 0 };
  const headers = records[0].map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const hasHeader = headers.some((h) => URL_COLS.includes(h) || SHORT_COLS.includes(h));
  let urlIdx = findCol(headers, URL_COLS);
  if (urlIdx < 0 && headers.indexOf("link") >= 0 && findCol(headers, SHORT_COLS) < 0) urlIdx = headers.indexOf("link");
  const shortIdx = findCol(headers, SHORT_COLS);
  const aliasIdx = findCol(headers, ALIAS_COLS);
  const titleIdx = findCol(headers, TITLE_COLS);
  const clickIdx = findCol(headers, CLICK_COLS);
  const tagIdx = findCol(headers, TAG_COLS);
  const dateIdx = findCol(headers, DATE_COLS);
  const body = hasHeader ? records.slice(1) : records;
  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const rec of body) {
    if (rows.length >= limit) break;
    let url = hasHeader && urlIdx >= 0 ? rec[urlIdx] : rec.find((c) => /^https?:\/\//i.test(c) && !/^(https?:\/\/)?(bit\.ly|tinyurl\.com|rebrand\.ly|short\.io|shorturl\.at)\//i.test(c)) ?? "";
    url = (url ?? "").trim();
    if (!url) { skipped++; continue; }
    const alias = hasHeader ? (aliasIdx >= 0 ? rec[aliasIdx] : pathAlias(shortIdx >= 0 ? rec[shortIdx] : null)) : null;
    const clicksRaw = hasHeader && clickIdx >= 0 ? parseInt((rec[clickIdx] ?? "").replace(/[^0-9]/g, ""), 10) : NaN;
    rows.push({
      url, alias: alias?.trim() || null, title: hasHeader && titleIdx >= 0 ? rec[titleIdx]?.trim() || null : null,
      clicks: Number.isFinite(clicksRaw) ? clicksRaw : 0, tags: hasHeader && tagIdx >= 0 ? normalizeTags(rec[tagIdx] ?? "") : [],
      createdAt: hasHeader && dateIdx >= 0 ? rec[dateIdx] || null : null,
    });
  }
  const name = (i: number) => (i >= 0 ? records[0][i] : null);
  return { rows, skipped, mapping: { url: name(urlIdx), alias: name(aliasIdx) ?? (shortIdx >= 0 ? `${records[0][shortIdx]} (path)` : null), title: name(titleIdx), clicks: name(clickIdx), tags: name(tagIdx) } };
}

// ------------------------------------------------------------------ Runner
/** Imports rows for a user, recording a MigrationJob with progress and per-row log. Plan limits apply (createLink). */
export async function runMigration(userId: string, source: MigrationSource, rows: ImportRow[], opts: MigrationOptions = {}): Promise<MigrationResult> {
  const batch = rows.slice(0, MAX_BATCH);
  const job = await db.migrationJob.create({ data: { userId, source, total: batch.length, status: "running" } });
  const log: MigrationResult["log"] = [];
  let imported = 0, skipped = 0;
  let stop = false;
  for (let i = 0; i < batch.length; i++) {
    const r = batch[i];
    if (stop) { skipped++; log.push({ row: i + 1, url: r.url, alias: r.alias ?? undefined, status: "skipped", error: "Plan limit reached" }); continue; }
    try {
      const url = normalizeUrl(r.url);
      if (!isValidUrl(url)) throw new LinkError("Invalid URL");
      const wantAlias = opts.keepAliases !== false && r.alias && isValidAlias(r.alias) ? r.alias : null;
      const tags = normalizeTags([...(r.tags ?? []), ...(opts.tag ? [opts.tag] : [])]);
      let link;
      try {
        link = await createLink(userId, { url, alias: wantAlias, title: r.title ?? null, domainId: opts.domainId ?? null, teamId: opts.teamId ?? null, tags }, { ip: opts.ip });
      } catch (e) {
        // Alias taken / not allowed → retry with a generated alias so the destination is still migrated.
        if (wantAlias && e instanceof LinkError && e.status !== 402 && /alias/i.test(e.message)) {
          link = await createLink(userId, { url, alias: null, title: r.title ?? null, domainId: opts.domainId ?? null, teamId: opts.teamId ?? null, tags }, { ip: opts.ip });
        } else throw e;
      }
      const historic = Math.max(0, Math.floor(r.clicks ?? 0));
      const createdAt = r.createdAt ? new Date(r.createdAt) : null;
      if (historic > 0 || (createdAt && !Number.isNaN(createdAt.getTime()))) {
        await db.link.update({ where: { id: link.id }, data: { ...(historic > 0 ? { clicks: historic } : {}), ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}) } });
      }
      imported++;
      log.push({ row: i + 1, url: r.url, alias: link.alias, status: "imported" });
    } catch (e) {
      skipped++;
      const msg = e instanceof Error ? e.message : "Failed";
      if (e instanceof LinkError && e.status === 402 && /limit/i.test(msg)) stop = true;
      log.push({ row: i + 1, url: r.url, alias: r.alias ?? undefined, status: "skipped", error: msg });
    }
    if (i % 25 === 24) await db.migrationJob.update({ where: { id: job.id }, data: { imported, skipped } });
  }
  await db.migrationJob.update({ where: { id: job.id }, data: { imported, skipped, status: stop ? "partial" : "done", log: JSON.stringify(log.slice(0, 1000)) } });
  await logActivity({ userId, action: "migration.run", target: "migration", targetId: job.id, meta: { source, imported, skipped, total: batch.length }, ip: opts.ip ?? null });
  return { jobId: job.id, total: batch.length, imported, skipped, log };
}

export function isMigrationError(e: unknown): e is MigrationError { return e instanceof MigrationError; }
