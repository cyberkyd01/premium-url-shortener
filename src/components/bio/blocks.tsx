import type { BioBlock } from "@prisma/client";
import { ExternalLink, Mail, Phone, Music2, Send, Ghost, MessageCircle, Gamepad2, Github, Ticket, Utensils, CalendarDays, Coffee, Download, FileText, ShoppingBag, CreditCard, Link as LinkIcon, MapPin, Smartphone } from "lucide-react";
import { blockContent, blockSize, miniMarkdown } from "@/lib/bio-widgets";
import { TrackedLink, ContactForm, NewsletterForm, PollBlock, Countdown, Carousel, FaqList, CookieNotice, VcardButton, RssFeed, HtmlInject, SensitiveReveal, BlockGate } from "./interactive";

export interface BlockRenderCtx { pageId: string; preview?: boolean; allowHtml: boolean; pollResults?: Record<string, Record<string, number>>; layout: string; host: string }

type C = Record<string, string | undefined>;
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function ytId(url: string) { const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/); return m?.[1] ?? ""; }
function vimeoId(url: string) { return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? ""; }
function spotifyEmbed(url: string) { const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/); return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : ""; }
function tiktokId(url: string) { return url.match(/video\/(\d+)/)?.[1] ?? ""; }
function tiktokUser(url: string) { return url.match(/tiktok\.com\/@([\w.-]+)/)?.[1] ?? ""; }
function igShortcode(url: string) { return url.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1] ?? ""; }
function twitchChannel(v: string) { return v.replace(/^https?:\/\/(www\.)?twitch\.tv\//, "").split(/[/?]/)[0]; }
function pinId(url: string) { return url.match(/pinterest\.[a-z.]+\/pin\/(\d+)/)?.[1] ?? ""; }

function Frame({ src, ratio = "16/9", title }: { src: string; ratio?: string; title: string }) {
  if (!src) return <Placeholder text="Add a valid URL" />;
  return <div className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: ratio, background: "rgba(0,0,0,.1)" }}><iframe src={src} title={title} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowFullScreen loading="lazy" /></div>;
}
function Placeholder({ text }: { text: string }) { return <div className="bio-card p-4 text-xs opacity-60 text-center">{text}</div>; }

function Btn({ block, href, icon, label, ctx, sub, newTab = true }: { block: BioBlock; href: string; icon?: React.ReactNode; label: string; ctx: BlockRenderCtx; sub?: string; newTab?: boolean }) {
  return (
    <TrackedLink blockId={block.id} href={href || "#"} preview={ctx.preview} className={"bio-btn" + (block.animation ? " bio-anim-" + block.animation : "")} newTab={newTab}>
      {block.thumbnail ? <img src={block.thumbnail} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" /> : icon ? <span className="shrink-0 w-10 grid place-items-center">{icon}</span> : <span className="w-10 shrink-0" />}
      <span className="flex-1 text-center min-w-0"><span className="block truncate">{label}</span>{sub && <span className="block text-xs font-normal opacity-70 truncate">{sub}</span>}</span>
      <span className="w-10 shrink-0" />
    </TrackedLink>
  );
}

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return <div className={"bio-card p-4 " + (className ?? "")}>{title && <h3 className="font-semibold mb-2">{title}</h3>}{children}</div>;
}

export function isWideBlock(type: string) {
  return !["link", "featured", "email", "phone", "snapchat", "telegram", "whatsapp", "discord", "eventbrite", "opentable", "booking", "paypal", "donation", "vcard", "file", "reddit"].includes(type);
}

function BlockInner({ block, ctx }: { block: BioBlock; ctx: BlockRenderCtx }) {
  const c = blockContent<C>(block);
  const title = block.title ?? "";
  const url = block.url ?? "";
  switch (block.type) {
    case "link": return <Btn block={block} href={url} label={title || url} ctx={ctx} icon={c.icon ? <LinkIcon size={18} /> : undefined} newTab={c.newTab !== "0"} />;
    case "featured": return (
      <TrackedLink blockId={block.id} href={url || "#"} preview={ctx.preview} className={"bio-card block overflow-hidden" + (block.animation ? " bio-anim-" + block.animation : "")}>
        {block.thumbnail && <img src={block.thumbnail} alt="" className="w-full aspect-video object-cover" />}
        <div className="p-4 text-left"><h3 className="font-semibold">{title}</h3>{c.description && <p className="text-sm opacity-80 mt-1">{c.description}</p>}<span className="bio-btn bio-btn-inline mt-3" style={{ width: "auto", display: "inline-flex" }}>{c.buttonText || "Open"}<ExternalLink size={14} /></span></div>
      </TrackedLink>);
    case "heading": { const size = c.size === "lg" ? "text-2xl" : c.size === "sm" ? "text-sm uppercase tracking-wide opacity-70" : "text-lg"; return <h2 className={"font-bold pt-2 " + size}>{title}</h2>; }
    case "text": return <div className={"text-sm leading-relaxed " + (c.align === "left" ? "text-left" : "")} dangerouslySetInnerHTML={{ __html: miniMarkdown(str(c.text)) }} />;
    case "divider": return c.style === "space" ? <div className="h-6" /> : c.style === "dots" ? <div className="text-center opacity-40 tracking-[0.5em]">•••</div> : <hr className="opacity-20 border-current" />;
    case "image": { const img = <img src={url} alt={title} className={"w-full object-cover " + (c.rounded !== "0" ? "rounded-xl" : "")} />; return url ? <figure>{c.link ? <TrackedLink blockId={block.id} href={c.link} preview={ctx.preview}>{img}</TrackedLink> : img}{title && <figcaption className="text-xs opacity-70 mt-1">{title}</figcaption>}</figure> : <Placeholder text="Upload an image" />; }
    case "gallery": { const imgs = list<{ url: string; link?: string }>(c.images).filter((i) => i?.url); if (!imgs.length) return <Placeholder text="Add images to the gallery" />; return <div className={"grid gap-2 " + (c.columns === "3" ? "grid-cols-3" : "grid-cols-2")}>{imgs.map((i, k) => { const im = <img src={i.url} alt="" className="w-full aspect-square object-cover rounded-lg" />; return i.link ? <a key={k} href={i.link} target="_blank" rel="noopener noreferrer">{im}</a> : <div key={k}>{im}</div>; })}</div>; }
    case "carousel": { const s = list<{ url: string; caption?: string; link?: string }>(c.images).filter((i) => i?.url); return s.length ? <Carousel slides={s} /> : <Placeholder text="Add slides" />; }
    case "video": return url ? <figure><video src={url} poster={c.poster} controls playsInline className="w-full rounded-xl" />{title && <figcaption className="text-xs opacity-70 mt-1">{title}</figcaption>}</figure> : <Placeholder text="Upload a video" />;
    case "audio": return url ? <Card title={title}><audio src={url} controls className="w-full" /></Card> : <Placeholder text="Upload an audio file" />;
    case "file": return <Btn block={block} href={url} label={title || "Download"} sub={c.description} icon={<Download size={18} />} ctx={ctx} />;
    case "pdf": return url ? <Card title={title}><iframe src={url} title={title || "PDF"} className="w-full rounded-lg" style={{ height: 420 }} /></Card> : <Placeholder text="Upload a PDF" />;
    case "giphy": return url ? <figure><img src={url} alt={title} className="w-full rounded-xl" />{title && <figcaption className="text-xs opacity-70 mt-1">{title}</figcaption>}</figure> : <Placeholder text="Pick a GIF" />;
    case "youtube": { const id = ytId(url); return <Frame src={id ? `https://www.youtube-nocookie.com/embed/${id}` : ""} title="YouTube" />; }
    case "vimeo": { const id = vimeoId(url); return <Frame src={id ? `https://player.vimeo.com/video/${id}` : ""} title="Vimeo" />; }
    case "spotify": { const src = spotifyEmbed(url); return src ? <iframe src={src} title="Spotify" className="w-full rounded-xl" height={url.includes("/track/") || url.includes("/episode/") ? 152 : 352} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" loading="lazy" /> : <Placeholder text="Add a Spotify URL" />; }
    case "soundcloud": return url ? <iframe title="SoundCloud" className="w-full rounded-xl" height={166} src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false`} loading="lazy" /> : <Placeholder text="Add a SoundCloud URL" />;
    case "applemusic": { const src = url.replace("https://music.apple.com", "https://embed.music.apple.com"); return url ? <iframe title="Apple Music" allow="autoplay *; encrypted-media *;" className="w-full rounded-xl" height={url.includes("?i=") ? 175 : 450} src={src} loading="lazy" /> : <Placeholder text="Add an Apple Music URL" />; }
    case "tiktok": { const id = tiktokId(url); if (id) return <Frame src={`https://www.tiktok.com/embed/v2/${id}`} ratio="9/16" title="TikTok" />; const u = tiktokUser(url); return u ? <Btn block={block} href={url} label={`@${u} on TikTok`} icon={<Music2 size={18} />} ctx={ctx} /> : <Placeholder text="Add a TikTok URL" />; }
    case "twitter": return url ? <Card><blockquote className="twitter-tweet" data-dnt="true"><a href={url}>{url}</a></blockquote><HtmlInject html='<script async src="https://platform.twitter.com/widgets.js"></script>' /></Card> : <Placeholder text="Add a post URL" />;
    case "instagram": { const sc = igShortcode(url); return sc ? <Frame src={`https://www.instagram.com/p/${sc}/embed`} ratio="4/5" title="Instagram" /> : <Placeholder text="Add an Instagram post URL" />; }
    case "facebook": return url ? <Frame src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true`} ratio="1/1" title="Facebook" /> : <Placeholder text="Add a Facebook post URL" />;
    case "linkedin": { const m = url.match(/urn:li:(?:share|activity|ugcPost):\d+/); return m ? <Frame src={`https://www.linkedin.com/embed/feed/update/${m[0]}`} ratio="4/5" title="LinkedIn" /> : url ? <Btn block={block} href={url} label={title || "View post on LinkedIn"} ctx={ctx} /> : <Placeholder text="Add a LinkedIn post URL" />; }
    case "threads": return url ? <Card><blockquote className="text-post-media" data-text-post-permalink={url}><a href={url}>{url}</a></blockquote><HtmlInject html='<script async src="https://www.threads.net/embed.js"></script>' /></Card> : <Placeholder text="Add a Threads post URL" />;
    case "reddit": return <Btn block={block} href={url} label={title || "View on Reddit"} ctx={ctx} icon={<MessageCircle size={18} />} />;
    case "pinterest": { const id = pinId(url); return id ? <Frame src={`https://assets.pinterest.com/ext/embed.html?id=${id}`} ratio="3/4" title="Pinterest" /> : url ? <Btn block={block} href={url} label={title || "View on Pinterest"} ctx={ctx} /> : <Placeholder text="Add a Pinterest URL" />; }
    case "snapchat": return <Btn block={block} href={`https://snapchat.com/add/${c.username ?? ""}`} label={title || `Add ${c.username ?? "me"} on Snapchat`} icon={<Ghost size={18} />} ctx={ctx} />;
    case "telegram": return <Btn block={block} href={`https://t.me/${(c.username ?? "").replace(/^@/, "")}`} label={title || "Message on Telegram"} icon={<Send size={18} />} ctx={ctx} />;
    case "whatsapp": return <Btn block={block} href={`https://wa.me/${(c.phone ?? "").replace(/\D/g, "")}${c.message ? "?text=" + encodeURIComponent(c.message) : ""}`} label={title || "Chat on WhatsApp"} icon={<MessageCircle size={18} />} ctx={ctx} />;
    case "discord": return c.serverId ? <Frame src={`https://discord.com/widget?id=${c.serverId}&theme=dark`} ratio="1/1" title="Discord" /> : <Btn block={block} href={url} label={title || "Join our Discord"} icon={<Gamepad2 size={18} />} ctx={ctx} />;
    case "twitch": { const ch = twitchChannel(c.channel ?? ""); const parent = ctx.host; return ch ? <Frame src={`https://player.twitch.tv/?channel=${ch}&parent=${parent}&muted=true`} title="Twitch" /> : <Placeholder text="Add a Twitch channel" />; }
    case "github": { const repo = (c.repo ?? "").replace(/^https?:\/\/github\.com\//, ""); return <Btn block={block} href={`https://github.com/${repo}`} label={title || repo || "GitHub"} sub={repo.includes("/") ? "Repository" : "Profile"} icon={<Github size={18} />} ctx={ctx} />; }
    case "email": return <Btn block={block} href={`mailto:${c.email ?? ""}${c.subject ? "?subject=" + encodeURIComponent(c.subject) : ""}`} label={title || "Send me an email"} icon={<Mail size={18} />} ctx={ctx} newTab={false} />;
    case "phone": return <Btn block={block} href={`tel:${(c.phone ?? "").replace(/[^+\d]/g, "")}`} label={title || "Call me"} icon={<Phone size={18} />} ctx={ctx} newTab={false} />;
    case "vcard": {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${c.lastName ?? ""};${c.firstName ?? ""};;;`, `FN:${[c.firstName, c.lastName].filter(Boolean).join(" ")}`];
      if (c.org) lines.push(`ORG:${c.org}`); if (c.jobTitle) lines.push(`TITLE:${c.jobTitle}`); if (c.phone) lines.push(`TEL;TYPE=CELL:${c.phone}`); if (c.email) lines.push(`EMAIL:${c.email}`); if (c.website) lines.push(`URL:${c.website}`); if (c.address) lines.push(`ADR;TYPE=WORK:;;${c.address};;;;`); if (c.photo) lines.push(`PHOTO;VALUE=URI:${c.photo.startsWith("http") ? c.photo : c.photo}`);
      lines.push("END:VCARD");
      return <VcardButton blockId={block.id} preview={ctx.preview} vcf={lines.join("\n")} label={title || "Save contact"} className={"bio-btn" + (block.animation ? " bio-anim-" + block.animation : "")} />;
    }
    case "contact": return <Card title={title || "Contact me"}><ContactForm pageId={ctx.pageId} blockId={block.id} preview={ctx.preview} buttonText={c.buttonText} successText={c.successText} /></Card>;
    case "newsletter": return <Card title={title || "Subscribe to my newsletter"}>{c.description && <p className="text-sm opacity-80 mb-2">{c.description}</p>}<NewsletterForm pageId={ctx.pageId} blockId={block.id} preview={ctx.preview} buttonText={c.buttonText} successText={c.successText} /></Card>;
    case "faq": { const items = list<{ q: string; a: string }>(c.items).filter((i) => i?.q); return <Card title={title}>{items.length ? <FaqList items={items} /> : <span className="text-xs opacity-60">Add questions</span>}</Card>; }
    case "poll": { const opts = list<{ label: string }>(c.options).map((o) => o?.label).filter(Boolean); return <Card title={title || "Poll"}>{opts.length ? <PollBlock pageId={ctx.pageId} blockId={block.id} preview={ctx.preview} options={opts} showResults={c.showResults !== "0"} initialResults={ctx.pollResults?.[block.id] ?? {}} /> : <span className="text-xs opacity-60">Add options</span>}</Card>; }
    case "countdown": return <Card title={title}>{c.date ? <Countdown date={c.date} endText={c.endText} /> : <span className="text-xs opacity-60">Pick a date</span>}</Card>;
    case "map": return c.address ? <div>{title && <p className="text-sm font-medium mb-1 flex items-center justify-center gap-1"><MapPin size={14} />{title}</p>}<Frame src={`https://www.google.com/maps?q=${encodeURIComponent(c.address)}&output=embed`} ratio="4/3" title="Map" /></div> : <Placeholder text="Add an address" />;
    case "calendly": return url ? <Frame src={url.includes("?") ? url : url + "?hide_gdpr_banner=1"} ratio="3/4" title="Calendly" /> : <Placeholder text="Add a Calendly URL" />;
    case "typeform": return url ? <Frame src={url} ratio="3/4" title="Typeform" /> : <Placeholder text="Add a Typeform URL" />;
    case "eventbrite": return <Btn block={block} href={url} label={title || "Get tickets"} icon={<Ticket size={18} />} ctx={ctx} />;
    case "opentable": return <Btn block={block} href={url} label={title || "Reserve a table"} icon={<Utensils size={18} />} ctx={ctx} />;
    case "booking": return <Btn block={block} href={url} label={title || "Book now"} sub={c.description} icon={<CalendarDays size={18} />} ctx={ctx} />;
    case "music": {
      const platforms: [string, string | undefined][] = [["Spotify", c.spotify], ["Apple Music", c.apple], ["YouTube Music", c.youtube], ["SoundCloud", c.soundcloud], ["Deezer", c.deezer], ["Amazon Music", c.amazon]];
      return (
        <div className="bio-card overflow-hidden">
          {(block.thumbnail || title) && <div className="flex items-center gap-3 p-4 pb-2">{block.thumbnail && <img src={block.thumbnail} alt="" className="h-14 w-14 rounded-lg object-cover" />}<div className="text-left"><h3 className="font-semibold">{title || "Listen now"}</h3><p className="text-xs opacity-70">Choose your platform</p></div></div>}
          <div className="p-4 pt-2 space-y-2">{platforms.filter(([, u]) => u).map(([name, u]) => <TrackedLink key={name} blockId={block.id} href={u!} preview={ctx.preview} className="bio-btn bio-btn-inline"><Music2 size={16} /><span className="flex-1 text-center">{name}</span></TrackedLink>)}{!platforms.some(([, u]) => u) && <span className="text-xs opacity-60">Add streaming links</span>}</div>
        </div>);
    }
    case "rss": return <Card title={title || "Latest posts"}><RssFeed url={url} count={parseInt(c.count ?? "5", 10) || 5} /></Card>;
    case "html": return ctx.allowHtml ? <HtmlInject html={str(c.html)} /> : <Placeholder text="Custom HTML requires a plan upgrade" />;
    case "product": return (
      <div className="bio-card overflow-hidden text-left">
        {block.thumbnail && <img src={block.thumbnail} alt="" className="w-full aspect-square object-cover" />}
        <div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{title}</h3>{c.price && <span className="font-bold whitespace-nowrap">{c.price}</span>}</div>{c.description && <p className="text-sm opacity-80 mt-1">{c.description}</p>}
          <TrackedLink blockId={block.id} href={url || "#"} preview={ctx.preview} className="bio-btn bio-btn-inline mt-3"><ShoppingBag size={16} /><span className="flex-1 text-center">{c.buttonText || "Buy now"}</span></TrackedLink></div>
      </div>);
    case "paypal": return <Btn block={block} href={`https://paypal.me/${(c.username ?? "").replace(/^@/, "")}${c.amount ? "/" + c.amount : ""}`} label={title || "Pay with PayPal"} icon={<CreditCard size={18} />} ctx={ctx} />;
    case "donation": { const u = c.provider === "kofi" ? `https://ko-fi.com/${c.username ?? ""}` : c.provider === "patreon" ? `https://patreon.com/${c.username ?? ""}` : c.provider === "custom" ? url : `https://buymeacoffee.com/${c.username ?? ""}`; return <Btn block={block} href={u} label={title || "Support me"} icon={<Coffee size={18} />} ctx={ctx} />; }
    case "app": return (
      <div>{title && <p className="font-medium mb-2">{title}</p>}<div className="flex flex-wrap gap-2 justify-center">
        {c.ios && <TrackedLink blockId={block.id} href={c.ios} preview={ctx.preview} className="bio-btn bio-btn-inline" style={{ width: "auto" }}><Smartphone size={16} />App Store</TrackedLink>}
        {c.android && <TrackedLink blockId={block.id} href={c.android} preview={ctx.preview} className="bio-btn bio-btn-inline" style={{ width: "auto" }}><Smartphone size={16} />Google Play</TrackedLink>}
        {!c.ios && !c.android && <span className="text-xs opacity-60">Add store links</span>}
      </div></div>);
    case "cookie": return ctx.preview ? <Placeholder text="Cookie notice (shown on the live page)" /> : <CookieNotice text={c.text || "We use cookies to improve your experience."} buttonText={c.buttonText} />;
    default: return <Btn block={block} href={url} label={title || block.type} icon={<FileText size={18} />} ctx={ctx} />;
  }
}

/** Renders one block with its sensitive / gate wrappers. */
export function BioBlockView({ block, ctx }: { block: BioBlock; ctx: BlockRenderCtx }) {
  const c = blockContent<C>(block);
  let node: React.ReactNode = <BlockInner block={block} ctx={ctx} />;
  if (block.sensitive) node = <SensitiveReveal>{node}</SensitiveReveal>;
  if (block.gated) node = <BlockGate pageId={ctx.pageId} blockId={block.id} gated={block.gated} password={c.gatePassword} minAge={parseInt(c.gateAge ?? "18", 10) || 18} preview={ctx.preview}>{node}</BlockGate>;
  const size = blockSize(c);
  const style: React.CSSProperties = {};
  if (size.width < 100) { style.width = size.width + "%"; style.marginLeft = size.align === "left" ? 0 : "auto"; style.marginRight = size.align === "right" ? 0 : "auto"; }
  if (size.scale !== 100) style.zoom = size.scale / 100;
  return <div className={"bio-block" + (ctx.layout === "grid" && isWideBlock(block.type) ? " bio-wide" : "")} data-type={block.type} style={Object.keys(style).length ? style : undefined}>{node}</div>;
}
