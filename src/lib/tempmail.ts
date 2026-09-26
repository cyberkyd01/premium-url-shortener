/**
 * Temporary (disposable) email inboxes.
 *
 * Settings (admin → /admin/temp-mail):
 *  - plugin.tempmail.domains   allowed inbox domains, one per line (empty = feature off)
 *  - plugin.tempmail.ttl       mailbox lifetime in minutes (default 60)
 *  - plugin.tempmail.guests    "1" when visitors may create a guest inbox on /temp-mail
 *  - plugin.tempmail.provider  inbound webhook provider: mailgun | sendgrid | postmark | cloudflare | generic
 *  - plugin.tempmail.secret    shared secret used to verify inbound webhooks
 */
import type { TempEmail, TempMailbox } from "@prisma/client";
import { db } from "./db";
import { getSetting } from "./settings";
import { randomToken } from "./utils";

export const TEMPMAIL_DEFAULT_TTL = 60;
export const TEMPMAIL_MAX_USER = 5;
export const TEMPMAIL_MAX_GUEST = 1;
export const TEMPMAIL_PROVIDERS = ["mailgun", "sendgrid", "postmark", "cloudflare", "generic"] as const;
export type TempMailProvider = (typeof TEMPMAIL_PROVIDERS)[number];

export class TempMailError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface TempMailConfig { domains: string[]; ttlMinutes: number; guests: boolean; provider: TempMailProvider; secret: string; enabled: boolean }

export async function tempMailConfig(): Promise<TempMailConfig> {
  const [domainsRaw, ttlRaw, guests, provider, secret] = await Promise.all([
    getSetting("plugin.tempmail.domains"), getSetting("plugin.tempmail.ttl"), getSetting("plugin.tempmail.guests"), getSetting("plugin.tempmail.provider"), getSetting("plugin.tempmail.secret"),
  ]);
  const domains = parseDomainList(domainsRaw);
  const ttl = parseInt(ttlRaw, 10);
  const p = TEMPMAIL_PROVIDERS.find((x) => x === provider) ?? "generic";
  return { domains, ttlMinutes: Number.isFinite(ttl) && ttl > 0 ? ttl : TEMPMAIL_DEFAULT_TTL, guests: guests === "1", provider: p, secret, enabled: domains.length > 0 };
}

export function parseDomainList(raw: string) {
  return Array.from(new Set(raw.split(/\r?\n|,|\s+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter((d) => /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(d))));
}

const LOCAL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/;

function randomLocal() {
  const words = ["blue", "swift", "quiet", "bright", "lucky", "amber", "cosmic", "misty", "rapid", "solar", "vivid", "zesty", "noble", "polar", "sunny", "witty"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}.${randomToken(4).toLowerCase().slice(0, 8)}`;
}

export type MailboxSummary = Pick<TempMailbox, "id" | "address" | "token" | "expiresAt" | "createdAt"> & { unread: number; total: number };

export function isMailboxExpired(m: Pick<TempMailbox, "expiresAt">, now = new Date()) {
  return m.expiresAt.getTime() <= now.getTime();
}

/** Creates a mailbox. Guests (userId null) get a random local part; logged-in users may pick a custom name. */
export async function createMailbox(userId: string | null, opts: { domain?: string | null; local?: string | null } = {}): Promise<TempMailbox> {
  const cfg = await tempMailConfig();
  if (!cfg.enabled) throw new TempMailError("Temporary email is not available", 404);
  if (!userId && !cfg.guests) throw new TempMailError("Please log in to create a temporary inbox", 401);
  const domain = (opts.domain ?? "").trim().toLowerCase() || cfg.domains[0];
  if (!cfg.domains.includes(domain)) throw new TempMailError("This domain is not available for temporary inboxes");
  const now = new Date();
  if (userId) {
    const active = await db.tempMailbox.count({ where: { userId, expiresAt: { gt: now } } });
    if (active >= TEMPMAIL_MAX_USER) throw new TempMailError(`You can keep up to ${TEMPMAIL_MAX_USER} active inboxes. Delete one to create another.`);
  }
  let local = (opts.local ?? "").trim().toLowerCase();
  if (local && !userId) local = ""; // guests cannot choose a name
  if (local && !LOCAL_RE.test(local)) throw new TempMailError("Inbox name may only contain letters, numbers, dots, dashes and underscores (2-32 chars)");
  const expiresAt = new Date(now.getTime() + cfg.ttlMinutes * 60_000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const address = `${local || randomLocal()}@${domain}`;
    const existing = await db.tempMailbox.findUnique({ where: { address } });
    if (existing) {
      if (isMailboxExpired(existing, now)) { await db.tempMailbox.delete({ where: { id: existing.id } }); }
      else if (local) throw new TempMailError("This inbox name is already in use");
      else continue;
    }
    return db.tempMailbox.create({ data: { address, userId, token: randomToken(24), expiresAt } });
  }
  throw new TempMailError("Could not allocate an inbox address, please try again");
}

/** Finds a mailbox by its access token (guests + API). Expired mailboxes are treated as missing. */
export async function mailboxByToken(token: string) {
  if (!token || token.length > 128) return null;
  const m = await db.tempMailbox.findUnique({ where: { token } });
  if (!m || isMailboxExpired(m)) return null;
  return m;
}

export async function listMailboxes(userId: string): Promise<MailboxSummary[]> {
  const rows = await db.tempMailbox.findMany({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { _count: { select: { emails: true } }, emails: { where: { read: false }, select: { id: true } } } });
  return rows.map((r) => ({ id: r.id, address: r.address, token: r.token, expiresAt: r.expiresAt, createdAt: r.createdAt, unread: r.emails.length, total: r._count.emails }));
}

export async function extendMailbox(id: string, opts: { userId?: string | null; token?: string | null }) {
  const cfg = await tempMailConfig();
  const m = await db.tempMailbox.findUnique({ where: { id } });
  if (!m) throw new TempMailError("Inbox not found", 404);
  if (opts.userId ? m.userId !== opts.userId : m.token !== opts.token) throw new TempMailError("Inbox not found", 404);
  const base = Math.max(Date.now(), m.expiresAt.getTime());
  const max = Date.now() + 7 * 86_400_000;
  const expiresAt = new Date(Math.min(max, base + cfg.ttlMinutes * 60_000));
  return db.tempMailbox.update({ where: { id }, data: { expiresAt } });
}

export async function deleteMailbox(id: string, opts: { userId?: string | null; token?: string | null }) {
  const m = await db.tempMailbox.findUnique({ where: { id } });
  if (!m) return;
  if (opts.userId ? m.userId !== opts.userId : m.token !== opts.token) return;
  await db.tempMailbox.delete({ where: { id } });
}

export interface InboundAttachment { name: string; size?: number; type?: string }
export interface InboundMessage { to: string | string[]; from: string; fromName?: string | null; subject?: string | null; text?: string | null; html?: string | null; attachments?: InboundAttachment[] }

export function parseAddress(v: string): { email: string; name: string } {
  const s = (v ?? "").trim();
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(s);
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].replace(/^"|"$/g, "").trim() };
  return { email: s.toLowerCase(), name: "" };
}

/** Stores an inbound message for each matching (non-expired) mailbox. Unknown or expired recipients are ignored. */
export async function storeInbound(msg: InboundMessage): Promise<{ stored: number; ignored: string[] }> {
  const recipients = (Array.isArray(msg.to) ? msg.to : msg.to.split(",")).map((r) => parseAddress(r).email).filter(Boolean);
  const from = parseAddress(msg.from);
  const now = new Date();
  let stored = 0;
  const ignored: string[] = [];
  const attachments = (msg.attachments ?? []).slice(0, 20).map((a) => ({ name: String(a.name ?? "attachment").slice(0, 200), size: typeof a.size === "number" ? a.size : undefined, type: a.type ? String(a.type).slice(0, 100) : undefined }));
  for (const to of Array.from(new Set(recipients))) {
    const mailbox = await db.tempMailbox.findUnique({ where: { address: to } });
    if (!mailbox || isMailboxExpired(mailbox, now)) { ignored.push(to); continue; }
    const count = await db.tempEmail.count({ where: { mailboxId: mailbox.id } });
    if (count >= 200) { ignored.push(to); continue; }
    await db.tempEmail.create({ data: {
      mailboxId: mailbox.id, fromAddress: from.email.slice(0, 320), fromName: (msg.fromName || from.name || null)?.slice(0, 200) ?? null,
      subject: (msg.subject ?? "").slice(0, 500) || null, text: (msg.text ?? "").slice(0, 200_000) || null, html: (msg.html ?? "").slice(0, 500_000) || null,
      attachments: JSON.stringify(attachments),
    } });
    stored++;
  }
  return { stored, ignored };
}

/** Deletes expired mailboxes (emails cascade). */
export async function purgeExpired() {
  const r = await db.tempMailbox.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { deleted: r.count };
}

/** Very small HTML sanitizer for rendering emails inside a sandboxed iframe: strips scripts, event handlers and external form actions. */
export function sanitizeEmailHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|iframe|object|embed|applet|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|iframe|object|embed|frame|frameset|applet|meta|base|link)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
    .replace(/<form\b/gi, '<form onsubmit="return false"');
}

export function serializeEmail(e: TempEmail, full = false) {
  let attachments: InboundAttachment[] = [];
  try { const parsed: unknown = JSON.parse(e.attachments); if (Array.isArray(parsed)) attachments = parsed as InboundAttachment[]; } catch { /* ignore */ }
  const base = { id: e.id, from: e.fromAddress, fromName: e.fromName, subject: e.subject, read: e.read, receivedAt: e.receivedAt.toISOString(), attachments, preview: (e.text ?? e.html?.replace(/<[^>]+>/g, " ") ?? "").replace(/\s+/g, " ").trim().slice(0, 140) };
  return full ? { ...base, text: e.text, html: e.html ? sanitizeEmailHtml(e.html) : null } : base;
}
export type SerializedEmail = ReturnType<typeof serializeEmail>;
