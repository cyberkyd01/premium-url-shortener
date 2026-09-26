import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getWorkspace, can } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 3000;
const KEEPALIVE_MS = 15000;

interface LiveClick {
  id: string; at: string; linkId: string | null; alias: string | null; countryCode: string | null; country: string | null; city: string | null;
  region: string | null; device: string | null; browser: string | null; os: string | null; referer: string | null; lat: number | null; lng: number | null; isUnique: boolean; isBot: boolean;
}

/**
 * GET /api/stream/clicks?linkId= — Server-Sent Events feed of new clicks on the workspace owner's links.
 * Events: `click` (LiveClick JSON), `hello` ({ total }), keep-alive comments every 15s.
 */
export async function GET(req: NextRequest) {
  const ws = await getWorkspace();
  if (!ws) return new Response("Unauthorized", { status: 401 });
  if (!can(ws, "links", "stats")) return new Response("Forbidden", { status: 403 });
  const linkId = req.nextUrl.searchParams.get("linkId") || null;
  if (linkId) {
    const owned = await db.link.findFirst({ where: { id: linkId, userId: ws.ownerId }, select: { id: true } });
    if (!owned) return new Response("Not found", { status: 404 });
  }
  const scope = linkId ? { linkId } : { link: { userId: ws.ownerId } };
  const encoder = new TextEncoder();
  let since = new Date();
  const seen = new Set<string>();
  let closed = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      const stop = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (pingTimer) clearInterval(pingTimer);
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", stop);
      const total = await db.click.count({ where: { ...scope, isBot: false } }).catch(() => 0);
      send("hello", { total, since: since.toISOString(), linkId });
      pingTimer = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`)); }, KEEPALIVE_MS);
      const poll = async () => {
        if (closed) return;
        try {
          const rows = await db.click.findMany({
            where: { ...scope, createdAt: { gte: since } },
            orderBy: { createdAt: "asc" }, take: 100,
            include: { link: { select: { alias: true } } },
          });
          for (const c of rows) {
            if (seen.has(c.id)) continue;
            seen.add(c.id);
            if (c.createdAt > since) since = c.createdAt;
            const payload: LiveClick = { id: c.id, at: c.createdAt.toISOString(), linkId: c.linkId, alias: c.link?.alias ?? null, countryCode: c.countryCode, country: c.country, city: c.city, region: c.region, device: c.device, browser: c.browser, os: c.os, referer: c.refererHost, lat: c.lat, lng: c.lng, isUnique: c.isUnique, isBot: c.isBot };
            send("click", payload);
          }
          if (seen.size > 2000) { const keep = [...seen].slice(-500); seen.clear(); for (const k of keep) seen.add(k); }
        } catch (e) { console.error("[stream]", e); }
        if (!closed) pollTimer = setTimeout(poll, POLL_MS);
      };
      pollTimer = setTimeout(poll, POLL_MS);
    },
    cancel() { closed = true; if (pollTimer) clearTimeout(pollTimer); if (pingTimer) clearInterval(pingTimer); },
  });

  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
