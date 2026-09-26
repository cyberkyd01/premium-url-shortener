import { db } from "./db";
import { getSettings } from "./settings";
import { verifyCaptcha } from "./captcha";
import { sendTemplate } from "./mail";
import { notifyAdmins } from "./notify";
import { escapeHtml } from "./utils";

export type FormResult = { ok: true; message: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
  captcha?: string | null;
  honeypot?: string | null;
  ip?: string;
}

/** Shared contact-form logic used by the server action and the JSON API. */
export async function submitContact(input: ContactInput): Promise<FormResult> {
  const s = await getSettings();
  const name = input.name.trim().slice(0, 100);
  const email = input.email.trim().toLowerCase();
  const subject = (input.subject ?? "").trim().slice(0, 200);
  const message = input.message.trim().slice(0, 5000);
  if (!name || !email || !message) return { ok: false, error: "Please fill in all required fields." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (s["captcha.onContact"] === "1" && !(await verifyCaptcha(input.captcha, input.ip))) return { ok: false, error: "Captcha verification failed. Please try again." };
  if (s["security.contactSpamCheck"] === "1") {
    if (input.honeypot) return { ok: false, error: "Your message was flagged as spam." };
    const urls = message.match(/https?:\/\/\S+/gi) ?? [];
    if (urls.length > 3) return { ok: false, error: "Your message contains too many links." };
  }
  await db.contact.create({ data: { name, email, subject: subject || null, message, ip: input.ip ?? null } });
  await sendTemplate("contact-form", s["site.email"], { name: escapeHtml(name), email: escapeHtml(email), subject: escapeHtml(subject), message: escapeHtml(message).replace(/\n/g, "<br/>") });
  await notifyAdmins("New contact message", `${name} <${email}>: ${subject || message.slice(0, 80)}`, "/admin/contacts");
  return { ok: true, message: "Thank you! Your message has been sent. We will get back to you shortly." };
}

export const REPORT_REASONS = ["spam", "phishing", "malware", "adult", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportInput {
  target: string;
  reason: string;
  details?: string;
  email?: string;
  userId?: string | null;
  captcha?: string | null;
  ip?: string;
}

function isReason(v: string): v is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(v);
}

/** Resolves a short URL / alias to a link or bio page, then stores an abuse report. */
export async function submitReport(input: ReportInput): Promise<FormResult> {
  const target = input.target.trim();
  const reason = input.reason.trim();
  const details = (input.details ?? "").trim().slice(0, 5000);
  const email = (input.email ?? "").trim().toLowerCase();
  if (!target) return { ok: false, error: "Please enter the short link or alias you want to report." };
  if (!isReason(reason)) return { ok: false, error: "Please select a reason." };
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  let alias = target;
  try {
    if (/^https?:\/\//i.test(target)) alias = new URL(target).pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    alias = target;
  }
  alias = alias.replace(/^\/+/, "").split("/")[0] ?? "";
  const link = alias ? await db.link.findFirst({ where: { alias }, select: { id: true } }) : null;
  const bio = !link && alias ? await db.bioPage.findFirst({ where: { alias }, select: { id: true } }) : null;
  await db.report.create({
    data: { linkId: link?.id ?? null, bioPageId: bio?.id ?? null, url: target.slice(0, 2000), reason, details: details || null, email: email || null, userId: input.userId ?? null },
  });
  await notifyAdmins("New abuse report", `${reason}: ${target}`, "/admin/reports");
  return { ok: true, message: "Thank you for your report. Our team will review it shortly." };
}

/** Newsletter subscription (idempotent). */
export async function subscribeNewsletter(emailRaw: string, source = "website"): Promise<FormResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  await db.newsletterSubscriber.upsert({ where: { email }, create: { email, source }, update: {} });
  return { ok: true, message: "You are subscribed. Thank you!" };
}
