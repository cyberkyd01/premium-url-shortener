"use client";
import { useState } from "react";
import { Twitter, Facebook, MessageCircle, Copy, Check } from "lucide-react";

export function ShareButtons({ url, title, size = 16 }: { url: string; title?: string | null; size?: number }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(url);
  const t = encodeURIComponent(title ?? "");
  const cls = "btn-ghost btn-sm !px-2";
  return (
    <div className="flex items-center gap-1">
      <a className={cls} href={`https://twitter.com/intent/tweet?url=${enc}&text=${t}`} target="_blank" rel="noreferrer" title="Share on X"><Twitter size={size} /></a>
      <a className={cls} href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} target="_blank" rel="noreferrer" title="Share on Facebook"><Facebook size={size} /></a>
      <a className={cls} href={`https://wa.me/?text=${t}%20${enc}`} target="_blank" rel="noreferrer" title="Share on WhatsApp"><MessageCircle size={size} /></a>
      <button type="button" className={cls} title="Copy link" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}>{copied ? <Check size={size} /> : <Copy size={size} />}</button>
    </div>
  );
}
