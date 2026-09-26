import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createLink, shortUrl, LinkError } from "@/lib/links";
import { getUserPlan } from "@/lib/plan";
import { appUrl, isValidUrl, normalizeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhook/slack — Slack slash command (`/shorten <url> [alias]`) + Events API `url_verification`.
 *
 * Request verification: HMAC "v0" signing secret (settings `slack.signingSecret`) or the legacy verification token
 * (settings `slack.verificationToken`). At least one must be configured.
 *
 * User mapping: a `Webhook` row with provider="slack", url="slack" and secret="<team_id>:<user_id>" links a Slack user
 * to an account. Users create it from /dashboard/tools by pasting their Slack team + user id.
 */

function ephemeral(text: string, blocks?: unknown[]) {
  return NextResponse.json({ response_type: "ephemeral", text, ...(blocks ? { blocks } : {}) });
}

function verifySignature(raw: string, req: NextRequest, signingSecret: string) {
  const ts = req.headers.get("x-slack-request-timestamp") || "";
  const sig = req.headers.get("x-slack-signature") || "";
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false; // replay protection
  const expected = "v0=" + crypto.createHmac("sha256", signingSecret).update(`v0:${ts}:${raw}`).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)); } catch { return false; }
}

function parseBody(raw: string, contentType: string): Record<string, string> {
  if (contentType.includes("application/json")) {
    try {
      const j: unknown = JSON.parse(raw);
      if (j && typeof j === "object") return Object.fromEntries(Object.entries(j as Record<string, unknown>).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
    } catch { /* fallthrough */ }
    return {};
  }
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export async function POST(req: NextRequest) {
  const s = await getSettings();
  if (s["slack.enabled"] !== "1") return NextResponse.json({ error: 1, message: "Slack integration is disabled" }, { status: 404 });
  const raw = await req.text();
  const body = parseBody(raw, req.headers.get("content-type") || "");

  // Events API handshake
  if (body.type === "url_verification" && body.challenge) {
    if (s["slack.signingSecret"] && !verifySignature(raw, req, s["slack.signingSecret"])) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    return NextResponse.json({ challenge: body.challenge });
  }

  // Request verification
  const signingSecret = s["slack.signingSecret"] || process.env.SLACK_SIGNING_SECRET || "";
  const verificationToken = s["slack.verificationToken"] || process.env.SLACK_VERIFICATION_TOKEN || "";
  if (signingSecret) {
    if (!verifySignature(raw, req, signingSecret)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  } else if (verificationToken) {
    if (body.token !== verificationToken) return NextResponse.json({ error: "invalid token" }, { status: 401 });
  } else {
    return NextResponse.json({ error: "Slack signing secret not configured" }, { status: 503 });
  }

  const teamId = body.team_id || "";
  const userId = body.user_id || "";
  const text = (body.text || "").trim();
  const command = body.command || "/shorten";
  const connectUrl = appUrl("/dashboard/tools");

  if (!teamId || !userId) return ephemeral("Could not identify your Slack user.");

  const mapping = await db.webhook.findFirst({ where: { provider: "slack", secret: `${teamId}:${userId}`, active: true } });
  if (!mapping) {
    return ephemeral(`Your Slack account is not connected yet.`, [
      { type: "section", text: { type: "mrkdwn", text: `*Connect Slack to ${s["site.name"]}*\nOpen <${connectUrl}|Dashboard → Tools → Slack>, paste your Slack IDs and save.` } },
      { type: "section", fields: [{ type: "mrkdwn", text: `*Team ID*\n\`${teamId}\`` }, { type: "mrkdwn", text: `*User ID*\n\`${userId}\`` }] },
      { type: "context", elements: [{ type: "mrkdwn", text: `Then run \`${command} https://example.com [alias]\` again.` }] },
    ]);
  }

  if (!text || text === "help") {
    return ephemeral(`Usage: \`${command} <url> [alias]\` — shortens the URL with ${s["site.name"]}.`);
  }

  const [rawUrl, alias] = text.split(/\s+/);
  const url = normalizeUrl(rawUrl.replace(/^<|>$/g, "").split("|")[0]);
  if (!isValidUrl(url)) return ephemeral(`That does not look like a valid URL: \`${rawUrl}\``);

  try {
    const { features, user } = await getUserPlan(mapping.userId);
    if (user.role !== "admin" && !features.slack) return ephemeral("Slack shortening is not included in your plan. Please upgrade.");
    const link = await createLink(mapping.userId, { url, alias: alias || null, title: null }, {});
    const short = shortUrl(link);
    await db.webhook.update({ where: { id: mapping.id }, data: { lastCalledAt: new Date() } }).catch(() => {});
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Short link created: ${short}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `:link: *Short link created*\n<${short}|${short}>` } },
        { type: "context", elements: [{ type: "mrkdwn", text: `Destination: ${link.url.length > 80 ? link.url.slice(0, 77) + "..." : link.url}${link.status === "pending" ? " — _awaiting approval_" : ""}` }] },
        { type: "actions", elements: [
          { type: "button", text: { type: "plain_text", text: "Open stats" }, url: appUrl(`/dashboard/links/${link.id}`) },
          { type: "button", text: { type: "plain_text", text: "Copy link" }, url: short },
        ] },
      ],
    });
  } catch (e) {
    const message = e instanceof LinkError ? e.message : "Could not shorten this link right now.";
    return ephemeral(`:warning: ${message}`);
  }
}

/** Slack sends GET only when a human opens the URL; explain what this endpoint is. */
export async function GET() {
  return NextResponse.json({ error: 0, message: "Slack slash command endpoint. Configure it as the Request URL of your /shorten command." });
}
