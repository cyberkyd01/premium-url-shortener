import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const db = new PrismaClient();
const PRO = { customAlias: true, password: true, expiration: true, geoTargeting: true, deviceTargeting: true, languageTargeting: true, timeTargeting: true, conditions: true, abTesting: true, deepLinks: true, utm: true, customParams: true, parameterTemplates: true, customSplash: true, redirectTypes: ["direct", "frame", "splash", "custom", "overlay"], premiumAlias: true, noAds: true, noBranding: true, api: true, import: true, export: true, customCss: true, customLogo: true, bioTemplates: true, bioCustomDomain: true, advancedQr: true, bulkQr: true, dynamicQr: true, clickLimit: true, cloaking: true, botBlock: true, inAppBreakout: true, webhooks: true, slack: true, aiCopilot: true, teams: true, metaTags: true, publicStats: true, statsRetentionDays: 365, overlays: true, pixels: true, archive: true, qrTypes: ["url", "text", "email", "phone", "sms", "wifi", "vcard", "location", "event", "app", "crypto", "whatsapp", "paypal", "link", "bio"] };
const FREE = { ...PRO, password: false, expiration: false, geoTargeting: false, deviceTargeting: false, languageTargeting: false, timeTargeting: false, conditions: false, abTesting: false, deepLinks: false, customParams: false, parameterTemplates: false, customSplash: false, redirectTypes: ["direct", "frame", "splash"], premiumAlias: false, noAds: false, noBranding: false, api: false, import: false, export: false, customCss: false, customLogo: false, bioTemplates: false, bioCustomDomain: false, advancedQr: false, bulkQr: false, clickLimit: false, cloaking: false, botBlock: false, inAppBreakout: false, webhooks: false, slack: false, aiCopilot: false, teams: false, metaTags: false, statsRetentionDays: 30, overlays: false, pixels: false, qrTypes: ["url", "text", "email", "phone", "sms", "wifi", "vcard", "location"] };
const BUSINESS = { ...PRO, customCss: false, customLogo: false, aiCopilot: false, cloaking: false };

async function main() {
  // Plans
  const free = await db.plan.upsert({ where: { slug: "free" }, update: {}, create: { name: "Free", slug: "free", description: "Get started with the basics", isFree: true, sortOrder: 0, limitLinks: 50, limitLinksMonthly: -1, limitBioPages: 1, limitQrCodes: 5, limitDomains: 0, limitCampaigns: 1, limitPixels: 0, limitSplash: 0, limitOverlays: 0, limitTeamMembers: 0, limitApiKeys: 1, limitAiCredits: 0, limitFiles: 0, limitStorageMb: 0, limitSms: 0, features: JSON.stringify(FREE) } });
  await db.plan.upsert({ where: { slug: "starter" }, update: {}, create: { name: "Starter", slug: "starter", description: "For creators and small teams", priceMonthly: 9, priceYearly: 90, priceLifetime: 0, sortOrder: 1, trialDays: 7, limitLinks: 1000, limitBioPages: 5, limitQrCodes: 50, limitQrMonthly: -1, limitDomains: 1, limitCampaigns: 10, limitPixels: 5, limitSplash: 3, limitOverlays: 3, limitTeamMembers: 2, limitApiKeys: 3, limitAiCredits: 50, limitFiles: 20, limitStorageMb: 500, limitSms: 100, features: JSON.stringify(BUSINESS) } });
  await db.plan.upsert({ where: { slug: "pro" }, update: {}, create: { name: "Pro", slug: "pro", description: "Everything unlimited", priceMonthly: 29, priceYearly: 290, priceLifetime: 999, sortOrder: 2, isFeatured: true, trialDays: 14, limitLinks: -1, limitBioPages: -1, limitQrCodes: -1, limitDomains: -1, limitCampaigns: -1, limitPixels: -1, limitSplash: -1, limitOverlays: -1, limitTeamMembers: 10, limitApiKeys: -1, limitAiCredits: 500, limitFiles: -1, limitStorageMb: 10240, limitSms: 1000, features: JSON.stringify(PRO) } });

  // Admin user
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin1234";
  await db.user.upsert({ where: { email }, update: {}, create: { email, username: "admin", name: "Administrator", password: await bcrypt.hash(password, 10), role: "admin", status: 1, emailVerified: new Date(), planId: free.id, apiKey: "pus_" + crypto.randomBytes(24).toString("hex"), affiliateCode: "admin", verified: true } });

  // Roles
  await db.role.upsert({ where: { slug: "administrator" }, update: {}, create: { name: "Administrator", slug: "administrator", description: "Full access", permissions: JSON.stringify(["*"]), isAdmin: true } });
  await db.role.upsert({ where: { slug: "moderator" }, update: {}, create: { name: "Moderator", slug: "moderator", description: "Moderate links, reports and users", permissions: JSON.stringify(["dashboard.view", "users.view", "links.view", "links.manage", "bio.manage", "reports.manage", "verification.manage"]) } });
  await db.role.upsert({ where: { slug: "editor" }, update: {}, create: { name: "Editor", slug: "editor", description: "Manage content", permissions: JSON.stringify(["dashboard.view", "pages.manage", "blog.manage", "help.manage", "testimonials.manage"]) } });

  // Language
  await db.language.upsert({ where: { code: "en" }, update: {}, create: { code: "en", name: "English", flag: "🇺🇸", isDefault: true, active: true } });

  // Theme
  await db.theme.upsert({ where: { slug: "default" }, update: {}, create: { slug: "default", name: "Default", active: true, config: JSON.stringify({ primary: "#6366f1", accent: "#8b5cf6", scheme: "system", menu: [] }) } });
  await db.theme.upsert({ where: { slug: "the23" }, update: {}, create: { slug: "the23", name: "The23", parent: "default", config: JSON.stringify({ primary: "#0ea5e9", accent: "#22d3ee", scheme: "light", homepage: "landing" }) } });
  await db.theme.upsert({ where: { slug: "saas" }, update: {}, create: { slug: "saas", name: "SaaS", parent: "default", config: JSON.stringify({ primary: "#10b981", accent: "#14b8a6", scheme: "dark", homepage: "saas", palette: "emerald" }) } });

  // Email templates
  const templates: [string, string, string][] = [
    ["welcome", "Welcome to {{site_name}}", "<p>Hi {{name}},</p><p>Welcome to {{site_name}}! Your account is ready.</p><p><a href=\"{{site_url}}/dashboard\">Go to your dashboard</a></p>"],
    ["verify-email", "Verify your email address", "<p>Hi {{name}},</p><p>Please confirm your email by clicking the link below:</p><p><a href=\"{{link}}\">Verify email</a></p>"],
    ["reset-password", "Reset your password", "<p>Hi {{name}},</p><p>Click below to reset your password. The link expires in 1 hour.</p><p><a href=\"{{link}}\">Reset password</a></p>"],
    ["two-factor", "Your login code", "<p>Your verification code is <strong>{{code}}</strong>. It expires in 10 minutes.</p>"],
    ["team-invite", "You have been invited to join {{team}}", "<p>{{inviter}} invited you to join the team <strong>{{team}}</strong> on {{site_name}}.</p><p><a href=\"{{link}}\">Accept invitation</a></p>"],
    ["payment-received", "Payment received - {{invoice}}", "<p>Thank you! We received your payment of {{amount}} for the {{plan}} plan.</p><p><a href=\"{{site_url}}/dashboard/billing\">View invoices</a></p>"],
    ["plan-expiring", "Your plan expires soon", "<p>Your {{plan}} plan expires on {{date}}. Renew to keep your premium features.</p>"],
    ["plan-expired", "Your plan has expired", "<p>Your {{plan}} plan has expired and your account was switched to the free plan.</p>"],
    ["link-approved", "Your link has been approved", "<p>Your link {{short}} was approved and is now active.</p>"],
    ["contact-form", "New contact message from {{name}}", "<p><strong>{{name}}</strong> ({{email}}) wrote:</p><p>{{message}}</p>"],
    ["affiliate-payout", "Affiliate payout processed", "<p>Your payout of {{amount}} has been sent.</p>"],
    ["ticket-reply", "New reply on ticket #{{number}}", "<p>There is a new reply on your ticket <strong>{{subject}}</strong>.</p><p><a href=\"{{link}}\">View ticket</a></p>"],
    ["verification-approved", "You are now verified", "<p>Congratulations! Your account has been verified.</p>"],
    ["bio-contact", "New message from your bio page", "<p>{{name}} ({{email}}) sent you a message via your bio page:</p><p>{{message}}</p>"],
  ];
  for (const [slug, subject, body] of templates) await db.emailTemplate.upsert({ where: { slug }, update: {}, create: { slug, subject, body } });

  // Pages
  const pages: [string, string, string][] = [
    ["Terms of Service", "terms", "<h2>Terms of Service</h2><p>By using this service you agree to these terms. Do not shorten links to illegal, phishing or malicious content.</p>"],
    ["Privacy Policy", "privacy", "<h2>Privacy Policy</h2><p>We collect minimal analytics (country, device, referrer) to provide statistics for link owners.</p>"],
    ["About", "about", "<h2>About us</h2><p>We build tools that help you share smarter.</p>"],
  ];
  for (const [title, slug, content] of pages) await db.page.upsert({ where: { slug }, update: {}, create: { title, slug, content } });

  // Help center
  const cat = await db.helpCategory.upsert({ where: { slug: "getting-started" }, update: {}, create: { name: "Getting Started", slug: "getting-started", icon: "Rocket" } });
  await db.helpArticle.upsert({ where: { slug: "how-to-shorten-a-link" }, update: {}, create: { title: "How to shorten a link", slug: "how-to-shorten-a-link", categoryId: cat.id, content: "<p>Paste your long URL on the homepage or in your dashboard, optionally pick a custom alias and click Shorten.</p>" } });
  await db.helpArticle.upsert({ where: { slug: "custom-domains" }, update: {}, create: { title: "Using a custom domain", slug: "custom-domains", categoryId: cat.id, content: "<p>Add your domain in Dashboard → Custom Domains, then point an A or CNAME record to this server.</p>" } });

  // FAQ & testimonials
  if ((await db.faq.count()) === 0) await db.faq.createMany({ data: [
    { question: "Is it free?", answer: "Yes, the free plan lets you shorten links with analytics. Upgrade for advanced features.", order: 1 },
    { question: "Can I use my own domain?", answer: "Yes, paid plans support branded custom domains.", order: 2 },
    { question: "Do links expire?", answer: "Links never expire unless you set an expiration date.", order: 3 },
  ] });
  if ((await db.testimonial.count()) === 0) await db.testimonial.createMany({ data: [
    { name: "Sarah K.", role: "Marketing Lead", content: "The geo-targeting and pixel features doubled our campaign ROI.", rating: 5, order: 1 },
    { name: "Daniel M.", role: "Creator", content: "Bio pages and QR codes in one place. Exactly what I needed.", rating: 5, order: 2 },
  ] });

  // Ticket categories, gateways, plugins
  for (const [name, order] of [["General", 0], ["Billing", 1], ["Technical", 2]] as [string, number][]) {
    if (!(await db.ticketCategory.findFirst({ where: { name } }))) await db.ticketCategory.create({ data: { name, order } });
  }
  const gateways = [["stripe", "Stripe"], ["paypal", "PayPal"], ["paddle", "Paddle Billing"], ["paddle-classic", "Paddle Classic"], ["paystack", "Paystack"], ["razorpay", "Razorpay"], ["mollie", "Mollie"], ["cryptocom", "Crypto.com"], ["coinpayments", "CoinPayments"], ["midtrans", "Midtrans"], ["lemonsqueezy", "Lemon Squeezy"], ["iyzico", "Iyzico"], ["mercadopago", "MercadoPago"], ["bank", "Bank Transfer"]];
  for (const [slug, name] of gateways) await db.paymentGateway.upsert({ where: { slug }, update: {}, create: { slug, name } });
  const plugins = [["helpdesk", "Helpdesk"], ["filehosting", "File Hosting"], ["sendsms", "Send SMS (Twilio)"], ["razorpay", "Razorpay Payments"], ["cryptocom", "Crypto.com Payments"], ["coinpayments", "CoinPayments"], ["midtrans", "Midtrans"], ["lemonsqueezy", "Lemon Squeezy"], ["iyzico", "Iyzico"], ["mollie", "Mollie"], ["mercadopago", "MercadoPago Payments"], ["tempmail", "Temporary Email"], ["cloudflare-ssl", "Cloudflare SaaS SSL"], ["bio-directory", "Bio Pages Directory"], ["blog-rss", "Blog RSS Feed"]];
  for (const [slug, name] of plugins) await db.plugin.upsert({ where: { slug }, update: {}, create: { slug, name, active: ["helpdesk", "filehosting", "sendsms"].includes(slug) } });

  console.log(`Seeded. Admin login: ${email} / ${password}`);
}

main().finally(() => db.$disconnect());
