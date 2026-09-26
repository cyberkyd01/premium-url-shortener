"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Lock, Loader2 } from "lucide-react";

// ------------------------------------------------------------------ Script-capable HTML injection
/** Renders HTML and re-executes any <script> tags (innerHTML does not run them). */
export function HtmlInject({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    el.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = old.text;
      old.replaceWith(s);
    });
  }, [html]);
  return <div ref={ref} className={className} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

// ------------------------------------------------------------------ Click tracking
export function trackBlockClick(blockId: string) {
  try {
    const body = JSON.stringify({ blockId });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/bio/click", new Blob([body], { type: "application/json" }));
    else fetch("/api/bio/click", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}

export function TrackedLink({ blockId, href, preview, className, style, children, newTab = true, download }: { blockId: string; href: string; preview?: boolean; className?: string; style?: CSSProperties; children: ReactNode; newTab?: boolean; download?: string }) {
  return (
    <a href={href} className={className} style={style} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined} download={download}
      onClick={(e) => { if (preview) { e.preventDefault(); return; } trackBlockClick(blockId); }}>
      {children}
    </a>
  );
}

// ------------------------------------------------------------------ Forms
async function submitBio(pageId: string, blockId: string, type: string, data: Record<string, string>) {
  const res = await fetch("/api/bio/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, blockId, type, data }) });
  const j = (await res.json().catch(() => ({}))) as { error?: number | string; message?: string; results?: Record<string, number> };
  if (!res.ok || (j.error && j.error !== 0)) throw new Error(j.message || "Something went wrong");
  return j;
}

const inputStyle: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--bio-text) 25%, transparent)", background: "color-mix(in srgb, var(--bio-bg-solid) 60%, transparent)", color: "var(--bio-text)", fontSize: 14, outline: "none" };

export function ContactForm({ pageId, blockId, preview, buttonText, successText }: { pageId: string; blockId: string; preview?: boolean; buttonText?: string; successText?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <p className="text-sm font-medium">{successText || "Thanks! Your message has been sent."}</p>;
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      if (preview) return;
      const fd = new FormData(e.currentTarget);
      setState("sending");
      try { await submitBio(pageId, blockId, "contact", { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), message: String(fd.get("message") ?? "") }); setState("done"); }
      catch (ex) { setErr(ex instanceof Error ? ex.message : "Failed"); setState("error"); }
    }}>
      <input name="name" placeholder="Your name" required style={inputStyle} />
      <input name="email" type="email" placeholder="Your email" required style={inputStyle} />
      <textarea name="message" placeholder="Message" required rows={3} style={inputStyle} />
      {state === "error" && <p className="text-xs text-red-500">{err}</p>}
      <button type="submit" className="bio-btn bio-btn-inline" disabled={state === "sending"}>{state === "sending" && <Loader2 size={14} className="animate-spin" />}{buttonText || "Send"}</button>
    </form>
  );
}

export function NewsletterForm({ pageId, blockId, preview, buttonText, successText, onDone }: { pageId: string; blockId: string; preview?: boolean; buttonText?: string; successText?: string; onDone?: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <p className="text-sm font-medium">{successText || "You are subscribed!"}</p>;
  return (
    <form className="flex gap-2" onSubmit={async (e) => {
      e.preventDefault();
      if (preview) return;
      const fd = new FormData(e.currentTarget);
      setState("sending");
      try { await submitBio(pageId, blockId, "newsletter", { email: String(fd.get("email") ?? "") }); setState("done"); onDone?.(); }
      catch (ex) { setErr(ex instanceof Error ? ex.message : "Failed"); setState("error"); }
    }}>
      <input name="email" type="email" placeholder="you@example.com" required style={{ ...inputStyle, flex: 1 }} />
      <button type="submit" className="bio-btn bio-btn-inline" style={{ width: "auto" }} disabled={state === "sending"}>{state === "sending" ? <Loader2 size={14} className="animate-spin" /> : buttonText || "Subscribe"}</button>
      {state === "error" && <p className="text-xs text-red-500 w-full">{err}</p>}
    </form>
  );
}

export function PollBlock({ pageId, blockId, preview, options, showResults, initialResults }: { pageId: string; blockId: string; preview?: boolean; options: string[]; showResults: boolean; initialResults: Record<string, number> }) {
  const key = "bio_poll_" + blockId;
  const [voted, setVoted] = useState<string | null>(null);
  const [results, setResults] = useState(initialResults);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { setVoted(localStorage.getItem(key)); } catch { /* ignore */ } }, [key]);
  const total = Object.values(results).reduce((a, b) => a + b, 0);
  if (voted && showResults) {
    return (
      <ul className="space-y-2">
        {options.map((o) => { const n = results[o] ?? 0; const pct = total ? Math.round((n / total) * 100) : 0; return (
          <li key={o} className="text-sm">
            <div className="flex justify-between"><span>{o}{voted === o ? " ✓" : ""}</span><span className="opacity-70">{pct}%</span></div>
            <div className="h-2 rounded mt-1" style={{ background: "color-mix(in srgb, var(--bio-text) 15%, transparent)" }}><div className="h-2 rounded" style={{ width: pct + "%", background: "var(--bio-button)" }} /></div>
          </li>); })}
        <li className="text-xs opacity-60">{total} vote{total === 1 ? "" : "s"}</li>
      </ul>
    );
  }
  if (voted) return <p className="text-sm">Thanks for voting!</p>;
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <button key={o} type="button" className="bio-btn bio-btn-inline" disabled={busy} onClick={async () => {
          if (preview) return;
          setBusy(true);
          try { const j = await submitBio(pageId, blockId, "poll", { option: o }); if (j.results) setResults(j.results); try { localStorage.setItem(key, o); } catch { /* ignore */ } setVoted(o); }
          catch { /* ignore */ } finally { setBusy(false); }
        }}>{o}</button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Countdown
export function Countdown({ date, endText }: { date: string; endText?: string }) {
  const target = useMemo(() => new Date(date).getTime(), [date]);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (now === null || isNaN(target)) return <div className="h-16" />;
  const diff = Math.max(0, target - now);
  if (diff === 0) return <p className="font-semibold">{endText || "It's time!"}</p>;
  const d = Math.floor(diff / 86400000), h = Math.floor((diff / 3600000) % 24), m = Math.floor((diff / 60000) % 60), s = Math.floor((diff / 1000) % 60);
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[["Days", d], ["Hours", h], ["Min", m], ["Sec", s]].map(([l, v]) => (
        <div key={String(l)} className="rounded-xl py-2" style={{ background: "color-mix(in srgb, var(--bio-text) 10%, transparent)" }}>
          <div className="text-2xl font-bold tabular-nums">{String(v).padStart(2, "0")}</div><div className="text-[10px] uppercase tracking-wide opacity-70">{l}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Carousel
export function Carousel({ slides }: { slides: { url: string; caption?: string; link?: string }[] }) {
  const [i, setI] = useState(0);
  if (!slides.length) return null;
  const s = slides[i % slides.length];
  const img = <img src={s.url} alt={s.caption ?? ""} className="w-full aspect-[4/3] object-cover rounded-xl" />;
  return (
    <div className="relative">
      {s.link ? <a href={s.link} target="_blank" rel="noopener noreferrer">{img}</a> : img}
      {s.caption && <p className="text-xs mt-1 opacity-80">{s.caption}</p>}
      {slides.length > 1 && (<>
        <button type="button" aria-label="Previous" onClick={() => setI((i - 1 + slides.length) % slides.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-1"><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Next" onClick={() => setI((i + 1) % slides.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-1"><ChevronRight size={18} /></button>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">{slides.map((_, k) => <span key={k} className={"h-1.5 w-1.5 rounded-full " + (k === i ? "bg-white" : "bg-white/40")} />)}</div>
      </>)}
    </div>
  );
}

// ------------------------------------------------------------------ FAQ
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--bio-text) 15%, transparent)" }}>
      {items.map((it, k) => (
        <div key={k} className="py-2">
          <button type="button" className="flex w-full items-center justify-between text-left text-sm font-medium" onClick={() => setOpen(open === k ? null : k)}>{it.q}<ChevronDown size={16} className={"transition " + (open === k ? "rotate-180" : "")} /></button>
          {open === k && <p className="text-sm mt-1 opacity-80 whitespace-pre-line">{it.a}</p>}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Cookie notice
export function CookieNotice({ text, buttonText }: { text: string; buttonText?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem("bio_cookie_ok")); } catch { setShow(true); } }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md rounded-xl bg-black/85 text-white p-4 text-sm flex items-center gap-3 shadow-lg">
      <span className="flex-1">{text}</span>
      <button type="button" className="rounded-lg bg-white text-black px-3 py-1.5 text-xs font-semibold" onClick={() => { try { localStorage.setItem("bio_cookie_ok", "1"); } catch { /* ignore */ } setShow(false); }}>{buttonText || "Got it"}</button>
    </div>
  );
}

// ------------------------------------------------------------------ vCard download
export function VcardButton({ blockId, preview, vcf, label, className }: { blockId: string; preview?: boolean; vcf: string; label: string; className: string }) {
  const href = useMemo(() => "data:text/vcard;charset=utf-8," + encodeURIComponent(vcf), [vcf]);
  return <TrackedLink blockId={blockId} preview={preview} href={href} className={className} newTab={false} download="contact.vcf"><Download size={18} /><span className="flex-1 text-center">{label}</span></TrackedLink>;
}

// ------------------------------------------------------------------ RSS
export function RssFeed({ url, count }: { url: string; count: number }) {
  const [items, setItems] = useState<{ title: string; link: string; date?: string }[] | null>(null);
  useEffect(() => {
    if (!url) { setItems([]); return; }
    fetch(`/api/bio/rss?url=${encodeURIComponent(url)}&count=${count}`).then((r) => r.json()).then((j: { items?: { title: string; link: string; date?: string }[] }) => setItems(j.items ?? [])).catch(() => setItems([]));
  }, [url, count]);
  if (items === null) return <p className="text-xs opacity-60">Loading feed…</p>;
  if (!items.length) return <p className="text-xs opacity-60">No items.</p>;
  return (
    <ul className="space-y-2 text-left">
      {items.map((it, k) => <li key={k}><a href={it.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline-offset-2 hover:underline">{it.title}</a>{it.date && <div className="text-[11px] opacity-60">{new Date(it.date).toLocaleDateString()}</div>}</li>)}
    </ul>
  );
}

// ------------------------------------------------------------------ Gates
export function SensitiveReveal({ children, label = "Sensitive content – click to reveal" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  return <button type="button" onClick={() => setOpen(true)} className="bio-btn bio-btn-inline"><Eye size={18} /><span className="flex-1 text-center">{label}</span></button>;
}

export function GateOverlay({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bio-card p-6 text-center space-y-3 my-6">
      <div className="mx-auto h-12 w-12 rounded-full grid place-items-center" style={{ background: "color-mix(in srgb, var(--bio-text) 10%, transparent)" }}><Lock size={22} /></div>
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </div>
  );
}

/** Page-level gates: age confirmation, NSFW / sensitive warning, newsletter gate (client-side), password (server verified via cookie). */
export function BioGates({ pageId, ageGate, nsfw, newsletterGate, needsPassword, preview, children }: { pageId: string; ageGate: number | null; nsfw: boolean; newsletterGate: boolean; needsPassword: boolean; preview?: boolean; children: ReactNode }) {
  const [ageOk, setAgeOk] = useState(false);
  const [nsfwOk, setNsfwOk] = useState(false);
  const [newsOk, setNewsOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState(""); const [pwErr, setPwErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      setAgeOk(!!localStorage.getItem("bio_age_" + pageId)); setNsfwOk(!!sessionStorage.getItem("bio_nsfw_" + pageId)); setNewsOk(!!localStorage.getItem("bio_news_" + pageId));
    } catch { /* ignore */ }
    setReady(true);
  }, [pageId]);
  const remember = useCallback((k: string, session = false) => { try { (session ? sessionStorage : localStorage).setItem(k + pageId, "1"); } catch { /* ignore */ } }, [pageId]);
  if (preview) return <>{children}</>;
  if (!ready) return <div className="min-h-40" />;
  if (needsPassword) {
    return (
      <GateOverlay title="This page is password protected">
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setPwErr("");
          const res = await fetch("/api/bio/gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, password: pw }) });
          setBusy(false);
          if (res.ok) window.location.reload(); else setPwErr("Incorrect password");
        }}>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" style={inputStyle} required />
          {pwErr && <p className="text-xs text-red-500">{pwErr}</p>}
          <button type="submit" className="bio-btn bio-btn-inline" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : "Unlock"}</button>
        </form>
      </GateOverlay>
    );
  }
  if (ageGate && !ageOk) {
    return (
      <GateOverlay title={`You must be ${ageGate}+ to view this page`}>
        <p className="text-sm opacity-80">Please confirm your age to continue.</p>
        <div className="flex gap-2 justify-center">
          <button type="button" className="bio-btn bio-btn-inline" style={{ width: "auto" }} onClick={() => { remember("bio_age_"); setAgeOk(true); }}>I am {ageGate} or older</button>
          <a href="https://google.com" className="bio-btn bio-btn-inline" style={{ width: "auto", opacity: 0.7 }}>Leave</a>
        </div>
      </GateOverlay>
    );
  }
  if (nsfw && !nsfwOk) {
    return (
      <GateOverlay title="Sensitive content">
        <p className="text-sm opacity-80">This page may contain content that is not suitable for all audiences.</p>
        <button type="button" className="bio-btn bio-btn-inline" onClick={() => { remember("bio_nsfw_", true); setNsfwOk(true); }}>Continue</button>
      </GateOverlay>
    );
  }
  if (newsletterGate && !newsOk) {
    return (
      <GateOverlay title="Subscribe to unlock this page">
        <p className="text-sm opacity-80">Enter your email to access the content.</p>
        <NewsletterForm pageId={pageId} blockId="" onDone={() => { remember("bio_news_"); setNewsOk(true); }} />
      </GateOverlay>
    );
  }
  return <>{children}</>;
}

/** Per-block gate (newsletter / password / age). Password blocks use a per-block password stored in the block config. */
export function BlockGate({ pageId, blockId, gated, password, minAge, preview, children }: { pageId: string; blockId: string; gated: string; password?: string; minAge?: number; preview?: boolean; children: ReactNode }) {
  const key = "bio_block_" + blockId;
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  useEffect(() => { try { setOk(!!localStorage.getItem(key)); } catch { /* ignore */ } }, [key]);
  const unlock = () => { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } setOk(true); };
  if (ok || preview) return <>{children}</>;
  if (gated === "newsletter") return <div className="bio-card p-4 space-y-2"><p className="text-sm font-medium flex items-center gap-2"><Lock size={14} /> Subscribe to unlock</p><NewsletterForm pageId={pageId} blockId={blockId} onDone={unlock} /></div>;
  if (gated === "age") return <div className="bio-card p-4 space-y-2"><p className="text-sm font-medium flex items-center gap-2"><Lock size={14} /> You must be {minAge || 18}+ to view this</p><button type="button" className="bio-btn bio-btn-inline" onClick={unlock}>I am {minAge || 18} or older</button></div>;
  return (
    <form className="bio-card p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (pw === (password ?? "")) unlock(); else setErr(true); }}>
      <p className="text-sm font-medium flex items-center gap-2"><Lock size={14} /> Enter password to unlock</p>
      <div className="flex gap-2"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Password" /><button type="submit" className="bio-btn bio-btn-inline" style={{ width: "auto" }}>Unlock</button></div>
      {err && <p className="text-xs text-red-500">Incorrect password</p>}
    </form>
  );
}
