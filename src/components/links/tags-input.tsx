"use client";
import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip-style tags editor: comma or Enter adds a tag; suggestions come from the user's existing tags. */
export function TagsInput({ value, onChange, suggestions = [], placeholder = "Add a tag…", disabled, max = 20 }: { value: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; placeholder?: string; disabled?: boolean; max?: number }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const lower = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    return suggestions.filter((s) => !lower.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  }, [text, suggestions, lower]);

  function add(raw: string) {
    const parts = raw.split(",").map((t) => t.trim().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p);
    onChange(next);
    setText("");
  }
  function remove(tag: string) { onChange(value.filter((v) => v !== tag)); }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(text); }
    else if (e.key === "Backspace" && !text && value.length) { e.preventDefault(); remove(value[value.length - 1]); }
    else if (e.key === "Escape") setFocus(false);
  }

  return (
    <div className="relative">
      <div className={cn("input flex flex-wrap items-center gap-1.5 min-h-10 cursor-text", disabled && "opacity-60")} onClick={() => ref.current?.focus()}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
            {t}
            {!disabled && <button type="button" aria-label={`Remove ${t}`} className="hover:text-danger" onClick={(e) => { e.stopPropagation(); remove(t); }}><X size={11} /></button>}
          </span>
        ))}
        <input ref={ref} className="flex-1 min-w-24 bg-transparent outline-none text-sm" value={text} disabled={disabled} placeholder={value.length ? "" : placeholder}
          onChange={(e) => { if (e.target.value.includes(",")) add(e.target.value); else setText(e.target.value); }}
          onKeyDown={onKey} onFocus={() => setFocus(true)} onBlur={() => { setTimeout(() => setFocus(false), 120); if (text.trim()) add(text); }} />
      </div>
      {focus && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full card p-1 max-h-48 overflow-auto">
          {matches.map((m) => <button type="button" key={m} className="w-full text-left rounded-md px-3 py-1.5 text-sm hover:bg-bg" onMouseDown={(e) => e.preventDefault()} onClick={() => add(m)}>{m}</button>)}
        </div>
      )}
      <p className="hint">Press Enter or comma to add. Tags help you filter and search links.</p>
    </div>
  );
}
