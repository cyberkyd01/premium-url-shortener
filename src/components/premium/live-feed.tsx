"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Radio, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiveClick {
  id: string; at: string; linkId: string | null; alias: string | null; countryCode: string | null; country: string | null; city: string | null;
  region: string | null; device: string | null; browser: string | null; os: string | null; referer: string | null; lat: number | null; lng: number | null; isUnique: boolean; isBot: boolean;
}

export function flagEmoji(code: string | null | undefined) {
  if (!code || code.length !== 2) return "🌐";
  const base = 127397;
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => base + c.charCodeAt(0)));
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const MAX_FEED = 200;

/** EventSource consumer: live counter, ticking feed, SVG world dots, pause/resume and link filter. */
export function LiveFeed({ links, initialLinkId }: { links: { id: string; alias: string; title: string | null }[]; initialLinkId?: string | null }) {
  const [linkId, setLinkId] = useState<string>(initialLinkId ?? "");
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [feed, setFeed] = useState<LiveClick[]>([]);
  const [buffered, setBuffered] = useState<LiveClick[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    setFeed([]); setBuffered([]); setSessionCount(0); setTotal(null); setStatus("connecting");
    const es = new EventSource(`/api/stream/clicks${linkId ? `?linkId=${encodeURIComponent(linkId)}` : ""}`);
    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "closed" : "connecting");
    es.addEventListener("hello", (e) => { try { const d = JSON.parse((e as MessageEvent<string>).data) as { total: number }; setTotal(d.total); } catch { /* ignore */ } });
    es.addEventListener("click", (e) => {
      let c: LiveClick;
      try { c = JSON.parse((e as MessageEvent<string>).data) as LiveClick; } catch { return; }
      if (c.isBot) return;
      setSessionCount((n) => n + 1);
      setTotal((t) => (t == null ? t : t + 1));
      if (pausedRef.current) setBuffered((b) => [c, ...b].slice(0, MAX_FEED));
      else { setFeed((f) => [c, ...f].slice(0, MAX_FEED)); setFlash(true); setTimeout(() => setFlash(false), 400); }
    });
    return () => es.close();
  }, [linkId]);

  const resume = () => { setFeed((f) => [...buffered, ...f].slice(0, MAX_FEED)); setBuffered([]); setPaused(false); };
  const points = useMemo(() => feed.filter((c) => c.lat != null && c.lng != null).slice(0, 300), [feed]);
  const countries = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of feed) m.set(c.countryCode ?? "??", (m.get(c.countryCode ?? "??") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [feed]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1", status === "open" ? "bg-success/15 text-success" : status === "closed" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning")}>
          {status === "open" ? <Wifi size={12} /> : <WifiOff size={12} />}{status === "open" ? "Live" : status === "closed" ? "Disconnected" : "Connecting…"}
        </span>
        <select className="input max-w-xs" value={linkId} onChange={(e) => setLinkId(e.target.value)} aria-label="Filter by link">
          <option value="">All links</option>
          {links.map((l) => <option key={l.id} value={l.id}>/{l.alias}{l.title ? ` · ${l.title}` : ""}</option>)}
        </select>
        {paused ? <button type="button" className="btn-primary btn-sm" onClick={resume}><Play size={14} /> Resume{buffered.length ? ` (${buffered.length} new)` : ""}</button> : <button type="button" className="btn-secondary btn-sm" onClick={() => setPaused(true)}><Pause size={14} /> Pause</button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cn("card p-5 transition", flash && "ring-2 ring-primary/50")}><p className="text-sm text-muted">Clicks this session</p><p className="text-3xl font-bold mt-1 tabular-nums">{sessionCount}</p><p className="text-xs text-muted mt-1">Since you opened this page</p></div>
        <div className="card p-5"><p className="text-sm text-muted">Total clicks</p><p className="text-3xl font-bold mt-1 tabular-nums">{total == null ? "…" : total.toLocaleString()}</p><p className="text-xs text-muted mt-1">{linkId ? "For the selected link" : "Across all your links"}</p></div>
        <div className="card p-5"><p className="text-sm text-muted">Top countries (live)</p><p className="text-2xl mt-1 leading-none">{countries.length ? countries.map(([c, n]) => <span key={c} title={`${c}: ${n}`} className="mr-1">{flagEmoji(c === "??" ? null : c)}</span>) : <span className="text-muted text-base">Waiting for clicks…</span>}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Live map</h3>
          <svg viewBox="0 0 360 180" className="w-full rounded-lg bg-bg border border-border" role="img" aria-label="Live click locations">
            {[30, 60, 90, 120, 150].map((y) => <line key={"h" + y} x1={0} x2={360} y1={y} y2={y} stroke="var(--border)" strokeWidth={0.5} />)}
            {[60, 120, 180, 240, 300].map((x) => <line key={"v" + x} y1={0} y2={180} x1={x} x2={x} stroke="var(--border)" strokeWidth={0.5} />)}
            <line x1={0} x2={360} y1={90} y2={90} stroke="var(--muted)" strokeOpacity={0.4} strokeWidth={0.6} />
            {points.map((c, i) => (
              <g key={c.id}>
                {i < 5 && <circle cx={c.lng! + 180} cy={90 - c.lat!} r={6 - i} fill="var(--primary)" fillOpacity={0.15} />}
                <circle cx={c.lng! + 180} cy={90 - c.lat!} r={i < 5 ? 2.4 : 1.6} fill="var(--primary)" fillOpacity={i < 5 ? 0.95 : 0.5}><title>{[c.city, c.country].filter(Boolean).join(", ")}</title></circle>
              </g>
            ))}
          </svg>
          <p className="hint">Newest clicks are highlighted. Locations are approximate (IP based).</p>
        </div>
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border"><h3 className="font-semibold flex items-center gap-2"><Radio size={16} className={cn(status === "open" && "text-danger animate-pulse")} /> Click feed</h3><span className="text-xs text-muted">{feed.length} shown</span></div>
          <div className="max-h-[32rem] overflow-y-auto">
            {feed.length === 0 ? <p className="text-sm text-muted p-5">Waiting for the next click… share a link to see it appear here in real time.</p> : (
              <table className="table">
                <thead><tr><th>Time</th><th>Link</th><th>Location</th><th>Device</th><th>Referrer</th></tr></thead>
                <tbody>{feed.map((c, i) => (
                  <tr key={c.id} className={cn(i === 0 && !paused && "animate-in")}>
                    <td className="text-xs whitespace-nowrap tabular-nums">{timeOf(c.at)}{c.isUnique && <span className="badge-green ml-1">new</span>}</td>
                    <td className="text-xs font-medium text-primary">/{c.alias ?? "?"}</td>
                    <td className="text-xs"><span className="mr-1">{flagEmoji(c.countryCode)}</span>{[c.city, c.region].filter(Boolean).join(", ") || c.country || "Unknown"}</td>
                    <td className="text-xs text-muted">{[c.device, c.os, c.browser].filter(Boolean).join(" · ") || "-"}</td>
                    <td className="text-xs text-muted max-w-[10rem] truncate">{c.referer || "Direct"}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
