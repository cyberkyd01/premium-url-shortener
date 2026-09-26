import nodemailer from "nodemailer";
import { db } from "./db";
import { getSettings } from "./settings";
import { appUrl } from "./utils";

export interface MailOptions { to: string; subject: string; html: string; text?: string }

/** Builds a transport from admin settings. Supports SMTP-compatible providers
 *  (Mailgun, SendGrid, Postmark, Amazon SES, Resend, Mailchimp Transactional all offer SMTP relays). */
async function transport() {
  const s = await getSettings();
  const provider = s["mail.provider"];
  if (provider === "log" || (!s["mail.host"] && !process.env.SMTP_HOST)) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  const presets: Record<string, { host: string; port: number; user?: string }> = {
    mailgun: { host: "smtp.mailgun.org", port: 587 },
    sendgrid: { host: "smtp.sendgrid.net", port: 587, user: "apikey" },
    postmark: { host: "smtp.postmarkapp.com", port: 587 },
    resend: { host: "smtp.resend.com", port: 465, user: "resend" },
    mailchimp: { host: "smtp.mandrillapp.com", port: 587 },
    ses: { host: `email-smtp.${s["mail.region"] || "us-east-1"}.amazonaws.com`, port: 587 },
  };
  const preset = presets[provider];
  const host = preset?.host || s["mail.host"] || process.env.SMTP_HOST;
  const port = preset?.port || parseInt(s["mail.port"] || process.env.SMTP_PORT || "587", 10);
  const user = preset?.user || s["mail.user"] || process.env.SMTP_USER;
  const pass = s["mail.apiKey"] || s["mail.pass"] || process.env.SMTP_PASS;
  return nodemailer.createTransport({ host, port, secure: port === 465 || s["mail.secure"] === "1", auth: user && pass ? { user, pass } : undefined });
}

export async function sendMail(opts: MailOptions) {
  const s = await getSettings();
  const from = `"${s["mail.fromName"] || s["site.name"]}" <${s["mail.from"] || process.env.MAIL_FROM || "no-reply@example.com"}>`;
  try {
    const t = await transport();
    const info = await t.sendMail({ from, ...opts });
    if ((info as { message?: unknown }).message && process.env.NODE_ENV !== "production") {
      console.log("[mail:log]", opts.to, opts.subject);
    }
    return true;
  } catch (e) {
    console.error("[mail] failed", e);
    return false;
  }
}

/** Renders a DB email template (admin editable, translatable) with {{placeholders}}. */
export async function sendTemplate(slug: string, to: string, vars: Record<string, string>, language = "en") {
  const s = await getSettings();
  const tpl =
    (await db.emailTemplate.findFirst({ where: { slug, language, active: true } })) ??
    (await db.emailTemplate.findFirst({ where: { slug, language: "en", active: true } }));
  const all: Record<string, string> = { ...vars, site_name: s["site.name"], site_url: appUrl() };
  const render = (str: string) => str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => all[k] ?? "");
  const subject = render(tpl?.subject ?? slug);
  const body = render(tpl?.body ?? Object.entries(vars).map(([k, v]) => `${k}: ${v}`).join("<br/>"));
  return sendMail({ to, subject, html: layout(body, s["site.name"]) });
}

function layout(body: string, siteName: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;color:#18181b">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
  <tr><td style="font-size:20px;font-weight:700;padding-bottom:16px">${siteName}</td></tr>
  <tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
  <tr><td style="font-size:12px;color:#71717a;padding-top:24px">&copy; ${new Date().getFullYear()} ${siteName}</td></tr>
  </table></td></tr></table></body></html>`;
}
