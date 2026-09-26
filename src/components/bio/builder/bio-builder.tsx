"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BioBlock, BioPage } from "@prisma/client";
import { ArrowLeft, Plus, GripVertical, Copy, Trash2, Eye, EyeOff, ChevronDown, ChevronUp, Check, Loader2, AlertCircle, ExternalLink, BarChart3, Smartphone, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetDef } from "@/lib/bio-widgets";
import { saveBio, type BioPageInput, type BioBlockInput } from "@/app/dashboard/bio/actions";
import { BioView } from "../bio-view";
import { BlockEditor } from "./block-editor";
import { BlockPicker } from "./block-picker";
import { ProfilePanel, AppearancePanel, SocialsPanel, SeoPanel, AccessPanel, PixelsPanel, type BuilderOptions } from "./settings-panels";

const TABS = [{ key: "blocks", label: "Blocks" }, { key: "profile", label: "Profile" }, { key: "appearance", label: "Appearance" }, { key: "socials", label: "Socials" }, { key: "seo", label: "SEO" }, { key: "access", label: "Access" }, { key: "pixels", label: "Pixels" }] as const;
type TabKey = (typeof TABS)[number]["key"];

const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(type: string): BioBlockInput {
  const def = widgetDef(type);
  return { id: null, clientId: uid(), type, title: def && ["link", "featured", "heading", "product", "booking", "contact", "newsletter", "faq", "poll", "countdown"].includes(type) ? def.label : "", url: "", thumbnail: "", content: {}, order: 0, enabled: true, scheduleStart: null, scheduleEnd: null, countries: [], languages: [], sensitive: false, gated: null, animation: null };
}

function toPage(p: BioPageInput, id: string, userId: string): BioPage {
  return {
    id, alias: p.alias, domainId: p.domainId, userId, teamId: null, channelId: p.channelId, name: p.name || null, bio: p.bio || null, avatar: p.avatar || null, cover: p.cover || null, verified: false,
    theme: p.theme, layout: p.layout, buttonStyle: p.buttonStyle, font: p.font, colors: JSON.stringify(p.colors), customCss: p.customCss || null, customJs: p.customJs || null, customLogo: p.customLogo || null, hideBranding: p.hideBranding,
    seo: JSON.stringify(p.seo), socials: JSON.stringify(p.socials), socialsPosition: p.socialsPosition, socialIconStyle: p.socialIconStyle, password: p.password || null, ageGate: p.ageGate, sensitive: p.sensitive,
    newsletterGate: p.newsletterGate, nsfwWarning: p.nsfwWarning, isDefault: false, listed: !!p.listed, isTemplate: false, templateName: null, status: p.status, views: 0, uniqueViews: 0, pixelsJson: JSON.stringify(p.pixelIds), contactEmail: p.contactEmail || null,
    createdAt: new Date(0), updatedAt: new Date(0),
  };
}
function toBlock(b: BioBlockInput, pageId: string, i: number): BioBlock {
  return { id: b.id ?? b.clientId, bioPageId: pageId, type: b.type, title: b.title || null, url: b.url || null, content: JSON.stringify(b.content), thumbnail: b.thumbnail || null, order: i, clicks: 0, enabled: b.enabled, scheduleStart: b.scheduleStart ? new Date(b.scheduleStart) : null, scheduleEnd: b.scheduleEnd ? new Date(b.scheduleEnd) : null, countries: JSON.stringify(b.countries), languages: JSON.stringify(b.languages), sensitive: b.sensitive, gated: b.gated, animation: b.animation, createdAt: new Date(0) };
}

export function BioBuilder({ pageId: initialId, userId, initialPage, initialBlocks, options, siteName, publicUrl, countries }: { pageId: string | null; userId: string; initialPage: BioPageInput; initialBlocks: BioBlockInput[]; options: BuilderOptions; siteName: string; publicUrl: string; countries: { code: string; name: string }[] }) {
  const [pageId, setPageId] = useState(initialId);
  const [page, setPage] = useState(initialPage);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [tab, setTab] = useState<TabKey>("blocks");
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const dirty = useRef(false);
  const latest = useRef({ page, blocks, pageId });
  latest.current = { page, blocks, pageId };
  const dragIdx = useRef<number | null>(null);

  const allowHtml = options.features.customCss || options.isAdmin;

  const save = useCallback(async () => {
    const { page: p, blocks: b, pageId: id } = latest.current;
    setStatus("saving");
    dirty.current = false;
    const res = await saveBio(id, p, b);
    if (!res.ok) { setStatus("error"); setError(res.error ?? "Failed to save"); return; }
    setError("");
    if (res.blockIds) setBlocks((cur) => cur.map((x) => (x.id ? x : { ...x, id: res.blockIds?.[x.clientId] ?? null })));
    if (!id && res.id) { setPageId(res.id); window.history.replaceState(null, "", `/dashboard/bio/${res.id}`); }
    setStatus(dirty.current ? "dirty" : "saved");
  }, []);

  const markDirty = useCallback(() => { dirty.current = true; setStatus((s) => (s === "saving" ? s : "dirty")); }, []);
  const setP = useCallback((patch: Partial<BioPageInput>) => { setPage((p) => ({ ...p, ...patch })); markDirty(); }, [markDirty]);
  const setB = useCallback((fn: (b: BioBlockInput[]) => BioBlockInput[]) => { setBlocks(fn); markDirty(); }, [markDirty]);

  // autosave
  useEffect(() => {
    if (status !== "dirty") return;
    const t = setTimeout(() => { save(); }, 2500);
    return () => clearTimeout(t);
  }, [status, page, blocks, save]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current || status === "dirty") { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [status]);

  const addBlock = (type: string) => { const b = newBlock(type); setB((list) => [...list, b]); setSelected(b.clientId); setTab("blocks"); };
  const move = (from: number, to: number) => { if (from === to || to < 0 || to >= blocks.length) return; setB((list) => { const a = [...list]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }); };

  const previewId = pageId ?? "preview";
  const previewPage = toPage(page, previewId, userId);
  const previewBlocks = blocks.map((b, i) => toBlock(b, previewId, i));
  const site = { name: siteName, url: "#", host: options.baseHost.split(":")[0], branding: true };

  const panel = { profile: ProfilePanel, appearance: AppearancePanel, socials: SocialsPanel, seo: SeoPanel, access: AccessPanel, pixels: PixelsPanel } as const;

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 flex flex-col" style={{ minHeight: "calc(100vh - 4rem)" }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-20">
        <Link href="/dashboard/bio" className="btn-ghost btn-sm"><ArrowLeft size={16} /></Link>
        <div className="min-w-0 flex-1"><p className="font-semibold truncate">{page.name || "Untitled bio page"}</p><p className="text-xs text-muted truncate">{publicUrl.replace(/^https?:\/\//, "")}</p></div>
        <span className={cn("text-xs flex items-center gap-1", status === "error" ? "text-danger" : "text-muted")}>
          {status === "saving" && <><Loader2 size={12} className="animate-spin" />Saving…</>}{status === "saved" && <><Check size={12} />Saved</>}{status === "dirty" && "Unsaved changes"}{status === "error" && <><AlertCircle size={12} />{error}</>}
        </span>
        <button type="button" className="btn-primary btn-sm" onClick={save} disabled={status === "saving"}>Save</button>
        {pageId && <Link href={`/dashboard/bio/${pageId}/stats`} className="btn-secondary btn-sm"><BarChart3 size={14} />Stats</Link>}
        {pageId && <a href={publicUrl} target="_blank" rel="noopener" className="btn-secondary btn-sm"><ExternalLink size={14} />View</a>}
      </div>

      <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[520px_minmax(0,1fr)]">
        {/* Left: editor */}
        <div className="border-r border-border bg-card overflow-y-auto" style={{ maxHeight: "calc(100vh - 8rem)" }}>
          <div className="flex gap-1 border-b border-border px-3 overflow-x-auto sticky top-0 bg-card z-10">
            {TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("px-3 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap", tab === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-fg")}>{t.label}</button>)}
          </div>
          <div className="p-4">
            {tab === "blocks" ? (
              <div className="space-y-2">
                <button type="button" className="btn-primary w-full" onClick={() => setPicker(true)}><Plus size={16} />Add block</button>
                {!blocks.length && <p className="text-sm text-muted text-center py-6">No blocks yet. Add links, embeds, forms and more.</p>}
                {blocks.map((b, i) => {
                  const def = widgetDef(b.type);
                  const open = selected === b.clientId;
                  return (
                    <div key={b.clientId} draggable={!open} onDragStart={() => { dragIdx.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragIdx.current !== null) move(dragIdx.current, i); dragIdx.current = null; }}
                      className={cn("rounded-xl border bg-card", open ? "border-primary" : "border-border", !b.enabled && "opacity-60")}>
                      <div className="flex items-center gap-2 px-2 py-2">
                        <span className="cursor-grab text-muted"><GripVertical size={16} /></span>
                        <button type="button" className="flex-1 text-left min-w-0" onClick={() => setSelected(open ? null : b.clientId)}>
                          <span className="text-xs text-muted uppercase tracking-wide">{def?.label ?? b.type}</span>
                          <span className="block text-sm truncate">{b.title || b.url || (typeof b.content.text === "string" ? b.content.text.slice(0, 40) : "") || "—"}</span>
                        </button>
                        {(b.scheduleStart || b.scheduleEnd || b.countries.length || b.languages.length || b.gated) ? <span className="badge-yellow">rules</span> : null}
                        <button type="button" className="btn-ghost btn-sm" title="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}><ChevronUp size={14} /></button>
                        <button type="button" className="btn-ghost btn-sm" title="Move down" onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1}><ChevronDown size={14} /></button>
                        <button type="button" className="btn-ghost btn-sm" title={b.enabled ? "Disable" : "Enable"} onClick={() => setB((l) => l.map((x) => (x.clientId === b.clientId ? { ...x, enabled: !x.enabled } : x)))}>{b.enabled ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                        <button type="button" className="btn-ghost btn-sm" title="Duplicate" onClick={() => setB((l) => { const copy = { ...b, id: null, clientId: uid() }; const a = [...l]; a.splice(i + 1, 0, copy); return a; })}><Copy size={14} /></button>
                        <button type="button" className="btn-ghost btn-sm text-danger" title="Delete" onClick={() => { if (confirm("Delete this block?")) setB((l) => l.filter((x) => x.clientId !== b.clientId)); }}><Trash2 size={14} /></button>
                      </div>
                      {open && <div className="border-t border-border p-3"><BlockEditor block={b} onChange={(nb) => setB((l) => l.map((x) => (x.clientId === b.clientId ? nb : x)))} giphyEnabled={options.giphyEnabled} allowHtml={allowHtml} countries={countries} /></div>}
                    </div>
                  );
                })}
              </div>
            ) : (() => { const Panel = panel[tab]; return <Panel page={page} set={setP} options={options} />; })()}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="bg-bg p-4 lg:p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 8rem)" }}>
          <div className="flex items-center justify-between mb-3"><p className="text-sm font-medium text-muted">Live preview</p><div className="flex gap-1"><button type="button" className={cn("btn-ghost btn-sm", device === "phone" && "bg-primary/10 text-primary")} onClick={() => setDevice("phone")}><Smartphone size={14} /></button><button type="button" className={cn("btn-ghost btn-sm", device === "desktop" && "bg-primary/10 text-primary")} onClick={() => setDevice("desktop")}><Monitor size={14} /></button></div></div>
          <div className={cn("mx-auto rounded-[2rem] border-8 border-fg/80 shadow-2xl overflow-hidden bg-white", device === "phone" ? "w-[375px] max-w-full" : "w-full rounded-xl border-4")} style={{ height: device === "phone" ? 740 : "calc(100vh - 14rem)" }}>
            <div className="h-full overflow-y-auto"><BioView page={previewPage} blocks={previewBlocks} preview site={site} allowHtml={allowHtml} /></div>
          </div>
        </div>
      </div>
      <BlockPicker open={picker} onClose={() => setPicker(false)} onPick={addBlock} allowHtml={allowHtml} />
    </div>
  );
}
