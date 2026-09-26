"use client";
import { useRef, useState } from "react";
import { Bold, Italic, Link2, Heading2, Image as ImageIcon, List, Code } from "lucide-react";

/** Minimal HTML editor: a textarea with a formatting toolbar and image upload via /api/upload. */
export function HtmlEditor({ name, label, defaultValue, rows = 16, hint }: { name: string; label?: string; defaultValue?: string; rows?: number; hint?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);
  function wrap(before: string, after = "") {
    const el = ref.current; if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const sel = value.slice(s, e) || "text";
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  }
  async function upload(file: File) {
    const fd = new FormData(); fd.append("file", file); fd.append("folder", "content");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = (await r.json().catch(() => ({}))) as { url?: string; message?: string };
    if (d.url) wrap(`<img src="${d.url}" alt="" />`); else alert(d.message || "Upload failed");
  }
  const btn = "btn-ghost btn-sm";
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-border bg-bg">
          <button type="button" className={btn} title="Bold" onClick={() => wrap("<strong>", "</strong>")}><Bold size={14} /></button>
          <button type="button" className={btn} title="Italic" onClick={() => wrap("<em>", "</em>")}><Italic size={14} /></button>
          <button type="button" className={btn} title="Heading" onClick={() => wrap("<h2>", "</h2>")}><Heading2 size={14} /></button>
          <button type="button" className={btn} title="List" onClick={() => wrap("<ul>\n  <li>", "</li>\n</ul>")}><List size={14} /></button>
          <button type="button" className={btn} title="Link" onClick={() => { const u = prompt("URL"); if (u) wrap(`<a href="${u}">`, "</a>"); }}><Link2 size={14} /></button>
          <button type="button" className={btn} title="Image" onClick={() => fileRef.current?.click()}><ImageIcon size={14} /></button>
          <button type="button" className={btn} title="Code" onClick={() => wrap("<pre><code>", "</code></pre>")}><Code size={14} /></button>
          <span className="flex-1" />
          <button type="button" className={btn} onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
        {preview
          ? <div className="prose-content p-4 min-h-40" dangerouslySetInnerHTML={{ __html: value }} />
          : <textarea ref={ref} name={name} value={value} onChange={(e) => setValue(e.target.value)} rows={rows} className="w-full p-3 text-sm font-mono bg-card outline-none" />}
        {preview && <input type="hidden" name={name} value={value} />}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
