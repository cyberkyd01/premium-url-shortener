import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { storeInbound, tempMailConfig, type InboundAttachment, type InboundMessage } from "@/lib/tempmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

function s(v: unknown) { return typeof v === "string" ? v : v === null || v === undefined ? "" : String(v); }
function rec(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}; }

async function readAny(req: NextRequest): Promise<{ fields: Record<string, unknown>; files: InboundAttachment[]; raw: string }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const raw = await req.text();
    try { return { fields: rec(JSON.parse(raw)), files: [], raw }; } catch { return { fields: {}, files: [], raw }; }
  }
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const fields: Record<string, unknown> = {};
    const files: InboundAttachment[] = [];
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) files.push({ name: v.name, size: v.size, type: v.type });
      else fields[k] = v;
    }
    return { fields, files, raw: "" };
  }
  const raw = await req.text();
  try { return { fields: rec(JSON.parse(raw)), files: [], raw }; } catch { return { fields: {}, files: [], raw }; }
}

function timingEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** POST /api/tempmail/inbound/{mailgun|sendgrid|postmark|cloudflare|generic} — inbound email webhook. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { provider } = await ctx.params;
  const cfg = await tempMailConfig();
  if (!cfg.enabled) return NextResponse.json({ error: "Temporary email is disabled" }, { status: 404 });
  const { fields, files, raw } = await readAny(req);
  let msg: InboundMessage | null = null;

  if (provider === "mailgun") {
    // Signature: HMAC-SHA256(timestamp + token) with the webhook signing key.
    if (cfg.secret) {
      const sig = rec(fields.signature);
      const timestamp = s(fields.timestamp || sig.timestamp), token = s(fields.token || sig.token), signature = s(fields.signature && typeof fields.signature === "string" ? fields.signature : sig.signature);
      const expected = crypto.createHmac("sha256", cfg.secret).update(timestamp + token).digest("hex");
      if (!signature || !timingEqual(expected, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const ed = rec(fields["event-data"]);
    const message = rec(ed.message);
    const headers = rec(message.headers);
    msg = {
      to: s(fields.recipient || fields.To || headers.to), from: s(fields.sender || fields.from || headers.from), subject: s(fields.subject || headers.subject),
      text: s(fields["body-plain"] || fields["stripped-text"]), html: s(fields["body-html"] || fields["stripped-html"]), attachments: files,
    };
  } else if (provider === "sendgrid") {
    if (cfg.secret) {
      const provided = req.headers.get("x-tempmail-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
      if (!timingEqual(provided, cfg.secret)) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
    let to = s(fields.to);
    try { const env = rec(JSON.parse(s(fields.envelope))); if (Array.isArray(env.to)) to = (env.to as unknown[]).map(s).join(","); } catch { /* no envelope */ }
    msg = { to, from: s(fields.from), subject: s(fields.subject), text: s(fields.text), html: s(fields.html), attachments: files };
  } else if (provider === "postmark") {
    if (cfg.secret) {
      const auth = req.headers.get("authorization") ?? "";
      const basic = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString("utf8").split(":").pop() ?? "" : "";
      const provided = req.headers.get("x-tempmail-secret") ?? req.nextUrl.searchParams.get("secret") ?? basic;
      if (!timingEqual(provided, cfg.secret)) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
    const toFull = Array.isArray(fields.ToFull) ? (fields.ToFull as unknown[]).map((t) => s(rec(t).Email)) : [];
    const fromFull = rec(fields.FromFull);
    const atts = Array.isArray(fields.Attachments) ? (fields.Attachments as unknown[]).map((a) => ({ name: s(rec(a).Name), size: Number(rec(a).ContentLength) || undefined, type: s(rec(a).ContentType) })) : [];
    msg = { to: toFull.length ? toFull : s(fields.To || fields.OriginalRecipient), from: s(fromFull.Email || fields.From), fromName: s(fromFull.Name), subject: s(fields.Subject), text: s(fields.TextBody), html: s(fields.HtmlBody), attachments: atts };
  } else if (provider === "cloudflare" || provider === "generic") {
    if (cfg.secret) {
      const provided = req.headers.get("x-tempmail-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
      if (!timingEqual(provided, cfg.secret)) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
    const to = Array.isArray(fields.to) ? (fields.to as unknown[]).map(s) : s(fields.to);
    const atts = Array.isArray(fields.attachments) ? (fields.attachments as unknown[]).map((a) => ({ name: s(rec(a).name || rec(a).filename), size: Number(rec(a).size) || undefined, type: s(rec(a).type || rec(a).contentType) })) : files;
    msg = { to, from: s(fields.from), fromName: s(fields.fromName || fields.from_name), subject: s(fields.subject), text: s(fields.text), html: s(fields.html), attachments: atts };
    if (!msg.from && raw && !Object.keys(fields).length) return NextResponse.json({ error: "Expected JSON body {to, from, subject, text, html}" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  if (!msg || !msg.to || (Array.isArray(msg.to) && msg.to.length === 0)) return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  const result = await storeInbound(msg);
  return NextResponse.json({ ok: true, ...result });
}
