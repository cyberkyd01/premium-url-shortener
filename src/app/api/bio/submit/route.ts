import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/api-auth";
import { clientIp } from "@/lib/geo";
import { sendTemplate } from "@/lib/mail";
import { json } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { subscribeMember } from "@/lib/mailchimp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Syncs a subscriber to Mailchimp (API v3) using the bio newsletter keys (bio.mailchimpKey / bio.mailchimpList). Never throws. */
async function mailchimpSync(email: string) {
  const r = await subscribeMember(email, {}, { source: "bio" });
  if (!r.ok && r.error !== "Mailchimp is not configured") console.error("[mailchimp] sync failed", r.error);
}

/** POST { pageId, blockId, type: contact|newsletter|poll, data } → BioSubmission. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  if (!rateLimit("bio-submit:" + ip, 20).ok) return NextResponse.json({ error: 1, message: "Too many submissions, try again later" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { pageId?: unknown; blockId?: unknown; type?: unknown; data?: unknown };
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const blockId = typeof body.blockId === "string" ? body.blockId : "";
  const type = typeof body.type === "string" ? body.type : "";
  const raw = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") data[k.slice(0, 40)] = v.slice(0, 5000);
  if (!pageId || !["contact", "newsletter", "poll"].includes(type)) return NextResponse.json({ error: 1, message: "Invalid request" }, { status: 400 });

  const page = await db.bioPage.findUnique({ where: { id: pageId }, include: { user: { select: { email: true, id: true } } } });
  if (!page || page.status !== "active") return NextResponse.json({ error: 1, message: "Page not found" }, { status: 404 });
  const block = blockId ? await db.bioBlock.findFirst({ where: { id: blockId, bioPageId: page.id } }) : null;

  if (type === "contact") {
    if (!EMAIL_RE.test(data.email ?? "") || !(data.message ?? "").trim()) return NextResponse.json({ error: 1, message: "Please fill in all fields" }, { status: 400 });
  }
  if (type === "newsletter") {
    if (!EMAIL_RE.test(data.email ?? "")) return NextResponse.json({ error: 1, message: "Please enter a valid email" }, { status: 400 });
    const dup = await db.bioSubmission.findFirst({ where: { bioPageId: page.id, type: "newsletter", data: { contains: `"email":"${data.email}"` } }, select: { id: true } });
    if (dup) return NextResponse.json({ error: 0, message: "Already subscribed" });
  }
  if (type === "poll") {
    if (!block || block.type !== "poll") return NextResponse.json({ error: 1, message: "Poll not found" }, { status: 400 });
    const opts = json<{ options?: { label: string }[] }>(block.content, {}).options?.map((o) => o.label) ?? [];
    if (!opts.includes(data.option ?? "")) return NextResponse.json({ error: 1, message: "Invalid option" }, { status: 400 });
  }

  await db.bioSubmission.create({ data: { bioPageId: page.id, blockId: block?.id ?? null, type, data: JSON.stringify(data), ip } });

  if (type === "contact") {
    const to = page.contactEmail || page.user.email;
    sendTemplate("bio-contact", to, { page_name: page.name ?? page.alias, page_alias: page.alias, name: data.name ?? "", email: data.email ?? "", message: data.message ?? "" }).catch(() => {});
    notify(page.userId, "New contact form message", `${data.name || data.email} sent a message on ${page.name ?? page.alias}`, { link: `/dashboard/bio/${page.id}/stats` }).catch(() => {});
  }
  if (type === "newsletter") mailchimpSync(data.email).catch(() => {});

  if (type === "poll" && block) {
    const subs = await db.bioSubmission.findMany({ where: { bioPageId: page.id, blockId: block.id, type: "poll" }, select: { data: true } });
    const results: Record<string, number> = {};
    for (const sub of subs) { const o = json<{ option?: string }>(sub.data, {}).option; if (o) results[o] = (results[o] ?? 0) + 1; }
    return NextResponse.json({ error: 0, results });
  }
  return NextResponse.json({ error: 0 });
}
