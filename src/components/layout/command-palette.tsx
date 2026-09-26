"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Link2, Loader2, Search, UserCircle, QrCode, Megaphone, FolderOpen, Plus, CreditCard, Settings, Moon, LogOut, LayoutDashboard, Globe, Activity, Webhook, ArrowRightLeft, Copy, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Hit { id: string; type: "link" | "bio" | "qr" | "campaign" | "channel"; title: string; subtitle?: string; href: string; short?: string; tags?: string[] }
interface Item { key: string; group: string; icon: LucideIcon; title: string; subtitle?: string; run: () => void | Promise<void> }

const TYPE_META: Record<Hit["type"], { icon: LucideIcon; group: string }> = {
  link: { icon: Link2, group: "Links" }, bio: { icon: UserCircle, group: "Bio pages" }, qr: { icon: QrCode, group: "QR codes" }, campaign: { icon: Megaphone, group: "Campaigns" }, channel: { icon: FolderOpen, group: "Channels" },
};

function looksLikeUrl(v: string) {
  const t = v.trim();
  if (!t || /\s/.test(t)) return false;
  if (/^https?:\/\/\S+/i.test(t)) return true;
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t);
}

/** Ctrl/Cmd+K palette: shorten a pasted URL, search links/bio/QR/campaigns/channels, or jump to a page. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<{ short?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setText(""); setHits([]); setResult(null); setActive(0); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);

  // Search (debounced) when the text is not a URL.
  useEffect(() => {
    const q = text.trim();
    if (!open || !q || looksLikeUrl(q)) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const d = (await r.json()) as { results?: Hit[] };
        setHits(d.results ?? []);
      } catch { /* aborted */ } finally { setLoading(false); }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text, open]);

  const go = useCallback((href: string) => { close(); router.push(href); }, [close, router]);
  const shorten = useCallback(async () => {
    const url = text.trim();
    setLoading(true); setResult(null);
    try {
      const r = await fetch("/api/shorten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const d = (await r.json()) as { error?: boolean; message?: string; short?: string };
      setResult(d.error ? { error: d.message ?? "Failed" } : { short: d.short });
      if (!d.error) router.refresh();
    } catch { setResult({ error: "Network error" }); } finally { setLoading(false); }
  }, [text, router]);

  const nav: Item[] = useMemo(() => [
    { key: "nav-links", group: "Navigate", icon: Link2, title: "Go to Links", run: () => go("/dashboard/links") },
    { key: "nav-new", group: "Navigate", icon: Plus, title: "New link", run: () => go("/dashboard/links/new") },
    { key: "nav-bio", group: "Navigate", icon: UserCircle, title: "New bio page", run: () => go("/dashboard/bio/new") },
    { key: "nav-qr", group: "Navigate", icon: QrCode, title: "New QR code", run: () => go("/dashboard/qr/new") },
    { key: "nav-overview", group: "Navigate", icon: LayoutDashboard, title: "Overview", run: () => go("/dashboard") },
    { key: "nav-campaigns", group: "Navigate", icon: Megaphone, title: "Campaigns", run: () => go("/dashboard/campaigns") },
    { key: "nav-domains", group: "Navigate", icon: Globe, title: "Custom domains", run: () => go("/dashboard/domains") },
    { key: "nav-activity", group: "Navigate", icon: Activity, title: "Activity log", run: () => go("/dashboard/activity") },
    { key: "nav-webhooks", group: "Navigate", icon: Webhook, title: "Webhook deliveries", run: () => go("/dashboard/webhooks") },
    { key: "nav-migrate", group: "Navigate", icon: ArrowRightLeft, title: "Migrate from Bitly / Rebrandly", run: () => go("/dashboard/migrate") },
    { key: "nav-billing", group: "Navigate", icon: CreditCard, title: "Billing", run: () => go("/dashboard/billing") },
    { key: "nav-settings", group: "Navigate", icon: Settings, title: "Settings", run: () => go("/dashboard/settings") },
    { key: "cmd-theme", group: "Commands", icon: Moon, title: "Toggle theme", run: () => { const d = !document.documentElement.classList.contains("dark"); document.documentElement.classList.toggle("dark", d); try { localStorage.setItem("theme", d ? "dark" : "light"); } catch { /* ignore */ } close(); } },
    { key: "cmd-logout", group: "Commands", icon: LogOut, title: "Logout", run: () => { close(); void signOut({ callbackUrl: "/" }); } },
  ], [go, close]);

  const q = text.trim();
  const isUrl = looksLikeUrl(q);
  const items: Item[] = useMemo(() => {
    if (isUrl) return [{ key: "shorten", group: "Shorten", icon: Link2, title: `Shorten ${q}`, subtitle: "Create a short link now", run: shorten }];
    const found: Item[] = hits.map((h) => ({ key: `${h.type}-${h.id}`, group: TYPE_META[h.type].group, icon: TYPE_META[h.type].icon, title: h.title, subtitle: [h.subtitle, h.tags?.length ? `#${h.tags.join(" #")}` : null].filter(Boolean).join(" · "), run: () => go(h.href) }));
    const ql = q.toLowerCase();
    const cmds = q ? nav.filter((n) => n.title.toLowerCase().includes(ql)) : nav;
    return [...found, ...cmds];
  }, [isUrl, q, hits, nav, shorten, go]);

  useEffect(() => { setActive(0); }, [items.length, q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); void items[active]?.run(); }
    else if (e.key === "Escape") close();
  }

  let lastGroup = "";
  return (
    <>
      <button type="button" className="btn-secondary btn-sm min-w-0" onClick={() => setOpen(true)} aria-label="Search or shorten"><Search size={14} /> <span className="truncate">Search or shorten…</span> <kbd className="hidden md:inline text-[10px] text-muted ml-1">Ctrl+K</kbd></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={close}>
          <div className="card w-full max-w-xl overflow-hidden animate-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
            <div className="flex items-center gap-2 px-4 border-b border-border">
              {loading ? <Loader2 size={16} className="animate-spin text-muted" /> : <Search size={16} className="text-muted" />}
              <input ref={inputRef} className="flex-1 bg-transparent py-3 outline-none text-sm" placeholder="Paste a URL to shorten, or search links, bio pages, QR codes…" value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} onKeyDown={onKey} />
              <kbd className="text-[10px] text-muted">Esc</kbd>
            </div>
            {result?.error && <p className="text-danger text-sm px-4 py-3">{result.error}</p>}
            {result?.short && (
              <div className="px-4 py-3 flex items-center gap-2 text-sm border-b border-border bg-success/5">
                <Check size={14} className="text-success" /><a href={result.short} target="_blank" rel="noreferrer" className="text-primary font-medium truncate flex-1">{result.short}</a>
                <button type="button" className="btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(result.short ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
              </div>
            )}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
              {items.length === 0 && !loading && <p className="text-sm text-muted px-4 py-6 text-center">No results for &quot;{q}&quot;</p>}
              {items.map((it, i) => {
                const header = it.group !== lastGroup; lastGroup = it.group;
                const Icon = it.icon;
                return (
                  <div key={it.key}>
                    {header && <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted font-semibold">{it.group}</p>}
                    <button type="button" data-idx={i} onMouseEnter={() => setActive(i)} onClick={() => void it.run()} className={cn("w-full flex items-center gap-3 px-4 py-2 text-left text-sm", i === active ? "bg-primary/10 text-primary" : "hover:bg-bg")}>
                      <Icon size={15} className="shrink-0" />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{it.title}</span>{it.subtitle && <span className="block truncate text-xs text-muted">{it.subtitle}</span>}</span>
                      {i === active && <kbd className="text-[10px] text-muted">↵</kbd>}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border text-[11px] text-muted flex gap-3"><span>↑↓ navigate</span><span>↵ select</span><span>Paste a URL to shorten instantly</span></div>
          </div>
        </div>
      )}
    </>
  );
}
