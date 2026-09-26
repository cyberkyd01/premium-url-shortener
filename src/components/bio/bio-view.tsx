import type { BioBlock, BioPage } from "@prisma/client";
import { BadgeCheck, Instagram, Twitter, Facebook, Youtube, Linkedin, Github, Twitch, Mail, Globe, MessageCircle, Send, Music2, Ghost, AtSign, Pin, Gamepad2, Phone } from "lucide-react";
import { parseBioJson, effectiveColors, blockVisible, SOCIAL_NETWORKS, type BioVisitor } from "@/lib/bio-widgets";
import { BioBlockView } from "./blocks";
import { BioGates, HtmlInject } from "./interactive";
import { PixelScripts, type PixelRef } from "./pixels";

export interface BioSite { name: string; url: string; host: string; branding: boolean; adsHtml?: string | null }
export interface BioViewProps {
  page: BioPage; blocks: BioBlock[]; preview?: boolean; visitor?: BioVisitor | null;
  site: BioSite; pixels?: PixelRef[]; allowHtml?: boolean; needsPassword?: boolean; pollResults?: Record<string, Record<string, number>>;
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { instagram: Instagram, twitter: Twitter, facebook: Facebook, tiktok: Music2, youtube: Youtube, linkedin: Linkedin, github: Github, whatsapp: MessageCircle, viber: Phone, telegram: Send, spotify: Music2, snapchat: Ghost, threads: AtSign, pinterest: Pin, twitch: Twitch, discord: Gamepad2, email: Mail, website: Globe };

function SocialRow({ socials, style }: { socials: { network: string; url: string }[]; style: string }) {
  if (!socials.length) return null;
  return (
    <div className="bio-socials">
      {socials.map((s, i) => {
        const Icon = ICONS[s.network] ?? Globe;
        const net = SOCIAL_NETWORKS.find((n) => n.key === s.network);
        const href = s.network === "email" && !s.url.startsWith("mailto:") ? "mailto:" + s.url : s.url;
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" aria-label={net?.label ?? s.network} className={"bio-social bio-social-" + style} style={style === "colored" ? { background: net?.color ?? "#64748b", color: "#fff" } : undefined}><Icon size={20} /></a>;
      })}
    </div>
  );
}

/** Isomorphic bio page view (used by the public route through BioRenderer and by the builder preview). */
export function BioView({ page, blocks, preview, visitor, site, pixels = [], allowHtml = false, needsPassword = false, pollResults }: BioViewProps) {
  const parsed = parseBioJson(page);
  const colors = effectiveColors(page.theme, parsed.colors);
  const now = new Date();
  const visible = blocks.filter((b) => (preview ? b.enabled : blockVisible(b, visitor, now))).sort((a, b) => a.order - b.order);
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(page.font || "Inter").replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
  const bgSolid = colors.bg;
  const bgCss = colors.bgGradient || colors.bg;
  const layout = page.layout || "centered";
  const socialsTop = page.socialsPosition === "top";
  const ctx = { pageId: page.id, preview, allowHtml, pollResults, layout, host: site.host };

  const profile = (
    <div className={"bio-profile" + (layout === "left" ? " bio-profile-left" : "")}>
      {page.avatar && <img src={page.avatar} alt={page.name ?? ""} className="bio-avatar" />}
      {page.name && <h1 className="bio-name">{page.name}{page.verified && <BadgeCheck size={20} className="bio-verified" aria-label="Verified" />}</h1>}
      {page.bio && <p className="bio-desc whitespace-pre-line">{page.bio}</p>}
      {socialsTop && <SocialRow socials={parsed.socials} style={page.socialIconStyle} />}
    </div>
  );

  const list = (
    <div className={"bio-blocks" + (layout === "grid" ? " bio-blocks-grid" : "")}>
      {visible.map((b) => <BioBlockView key={b.id} block={b} ctx={ctx} />)}
      {!visible.length && preview && <div className="bio-card p-6 text-center text-sm opacity-60">Add your first block from the left panel</div>}
    </div>
  );

  return (
    <div className={`bio-root bio-layout-${layout} bio-btnstyle-${page.buttonStyle}` + (colors.animation ? ` bio-anim-bg-${colors.animation}` : "")} style={{ ["--bio-bg" as string]: bgCss, ["--bio-bg-solid" as string]: bgSolid, ["--bio-text" as string]: colors.text, ["--bio-button" as string]: colors.button, ["--bio-button-text" as string]: colors.buttonText, ["--bio-link" as string]: colors.link ?? colors.text, ["--bio-font" as string]: `"${page.font || "Inter"}", system-ui, sans-serif` }}>
      <link rel="stylesheet" href={fontUrl} />
      <style dangerouslySetInnerHTML={{ __html: BIO_CSS }} />
      {page.customCss && allowHtml && <style dangerouslySetInnerHTML={{ __html: page.customCss.slice(0, 20000) }} />}
      {page.customJs && allowHtml && !preview && <HtmlInject html={`<script>${page.customJs.slice(0, 20000).replace(/<\/script/gi, "<\\/script")}</script>`} />}
      {!preview && <PixelScripts pixels={pixels} />}
      {page.cover && <div className="bio-cover" style={{ backgroundImage: `url(${page.cover})` }} />}
      <div className={"bio-container" + (page.cover ? " bio-has-cover" : "")}>
        {page.customLogo && <img src={page.customLogo} alt="" className="bio-logo" />}
        <BioGates pageId={page.id} ageGate={page.ageGate} nsfw={page.nsfwWarning || page.sensitive} newsletterGate={page.newsletterGate} needsPassword={needsPassword} preview={preview}>
          {layout === "split" ? <div className="bio-split"><div className="bio-split-left">{profile}</div><div className="bio-split-right">{list}</div></div>
            : layout === "card" ? <div className="bio-cardwrap">{profile}{list}</div>
            : <>{profile}{list}</>}
          {!socialsTop && <SocialRow socials={parsed.socials} style={page.socialIconStyle} />}
        </BioGates>
        {site.adsHtml && !preview && <div className="bio-ads"><HtmlInject html={site.adsHtml} /></div>}
        {site.branding && !page.hideBranding && <a href={site.url} className="bio-branding" target="_blank" rel="noopener">Made with {site.name}</a>}
      </div>
    </div>
  );
}

const BIO_CSS = `
.bio-root{min-height:100%;background:var(--bio-bg);color:var(--bio-text);font-family:var(--bio-font);position:relative;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.bio-root a{color:inherit}
.bio-container{position:relative;max-width:600px;margin:0 auto;padding:40px 20px 32px}
.bio-layout-split .bio-container{max-width:1000px}
.bio-cover{height:200px;background-size:cover;background-position:center}
.bio-has-cover{padding-top:0}
.bio-has-cover .bio-avatar{margin-top:-48px;border:4px solid var(--bio-bg-solid)}
.bio-logo{height:32px;margin:0 auto 24px;display:block}
.bio-profile{text-align:center;margin-bottom:24px}
.bio-layout-left .bio-profile,.bio-layout-left .bio-blocks,.bio-layout-left .bio-socials{text-align:left;justify-content:flex-start}
.bio-layout-left .bio-avatar{margin-left:0}
.bio-avatar{width:96px;height:96px;border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block;box-shadow:0 8px 24px rgba(0,0,0,.15)}
.bio-name{font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;margin:0}
.bio-layout-left .bio-name{justify-content:flex-start}
.bio-verified{color:#3b82f6}
.bio-desc{margin:8px 0 0;font-size:15px;opacity:.85;line-height:1.5}
.bio-socials{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:18px 0}
.bio-social{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;transition:transform .15s}
.bio-social:hover{transform:scale(1.12)}
.bio-social-circle{border-radius:50%;background:color-mix(in srgb,var(--bio-text) 10%,transparent)}
.bio-social-square{border-radius:10px;background:color-mix(in srgb,var(--bio-text) 10%,transparent)}
.bio-social-colored{border-radius:50%}
.bio-blocks{display:flex;flex-direction:column;gap:14px}
.bio-blocks-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.bio-blocks-grid .bio-wide{grid-column:span 2}
.bio-blocks-grid .bio-btn{flex-direction:column;padding:18px 12px}
.bio-blocks-grid .bio-btn > span:last-child{display:none}
.bio-split{display:grid;grid-template-columns:1fr;gap:32px}
@media(min-width:768px){.bio-split{grid-template-columns:340px 1fr}.bio-split-left{position:sticky;top:32px;align-self:start}}
.bio-cardwrap{background:color-mix(in srgb,var(--bio-bg-solid) 75%,transparent);backdrop-filter:blur(12px);border:1px solid color-mix(in srgb,var(--bio-text) 10%,transparent);border-radius:24px;padding:28px 22px;box-shadow:0 20px 60px rgba(0,0,0,.12)}
.bio-btn{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;background:var(--bio-button);color:var(--bio-button-text);font-weight:600;font-size:15px;text-decoration:none;transition:transform .15s,box-shadow .15s;border:0;cursor:pointer;font-family:inherit;box-sizing:border-box}
.bio-btn:hover{transform:scale(1.02)}
.bio-btn-inline{padding:10px 14px;font-size:14px;justify-content:center}
.bio-btnstyle-rounded .bio-btn{border-radius:12px}
.bio-btnstyle-square .bio-btn{border-radius:0}
.bio-btnstyle-pill .bio-btn{border-radius:999px}
.bio-btnstyle-outline .bio-btn{border-radius:12px;background:transparent;border:2px solid var(--bio-button);color:var(--bio-text)}
.bio-btnstyle-shadow .bio-btn{border-radius:12px;box-shadow:0 10px 24px -6px rgba(0,0,0,.25)}
.bio-btnstyle-hard-shadow .bio-btn{border-radius:8px;border:2px solid var(--bio-text);box-shadow:4px 4px 0 var(--bio-text)}
.bio-btnstyle-hard-shadow .bio-btn:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 var(--bio-text)}
.bio-btnstyle-frosted .bio-btn{border-radius:14px;background:color-mix(in srgb,var(--bio-button) 25%,transparent);backdrop-filter:blur(10px);border:1px solid color-mix(in srgb,var(--bio-text) 25%,transparent);color:var(--bio-text)}
.bio-card{background:color-mix(in srgb,var(--bio-text) 7%,transparent);border:1px solid color-mix(in srgb,var(--bio-text) 10%,transparent);border-radius:16px;text-decoration:none;box-sizing:border-box}
.bio-btnstyle-square .bio-card{border-radius:0}
.bio-btnstyle-hard-shadow .bio-card{border:2px solid var(--bio-text);box-shadow:4px 4px 0 var(--bio-text);border-radius:8px}
.bio-btnstyle-frosted .bio-card{backdrop-filter:blur(10px)}
.bio-ads{margin:24px 0;text-align:center}
.bio-branding{display:block;text-align:center;font-size:12px;opacity:.6;margin-top:28px;text-decoration:none}
.bio-branding:hover{opacity:1}
@keyframes bio-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes bio-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}
@keyframes bio-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes bio-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-1.5deg)}75%{transform:rotate(1.5deg)}}
@keyframes bio-glow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--bio-button) 50%,transparent)}50%{box-shadow:0 0 0 8px transparent}}
.bio-anim-pulse{animation:bio-pulse 2s ease-in-out infinite}
.bio-anim-shake{animation:bio-shake 3s ease-in-out infinite}
.bio-anim-bounce{animation:bio-bounce 2s ease-in-out infinite}
.bio-anim-wobble{animation:bio-wobble 2.5s ease-in-out infinite}
.bio-anim-glow{animation:bio-glow 2s ease-in-out infinite}
@keyframes bio-gradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.bio-anim-bg-gradient{background-size:400% 400%;animation:bio-gradient 14s ease infinite}
@keyframes bio-particles{0%{background-position:0 0,0 0,0 0}100%{background-position:200px 400px,-300px 200px,150px -250px}}
.bio-anim-bg-particles::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(2px 2px at 20px 30px,rgba(255,255,255,.7),transparent),radial-gradient(2px 2px at 120px 90px,rgba(255,255,255,.5),transparent),radial-gradient(1.5px 1.5px at 60px 160px,rgba(255,255,255,.6),transparent);background-size:220px 220px,300px 300px,260px 260px;animation:bio-particles 40s linear infinite;opacity:.8}
`;
