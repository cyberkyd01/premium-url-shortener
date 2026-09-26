"use client";
import { useMemo, useState } from "react";
import { Search, Lock } from "lucide-react";
import { Modal } from "@/components/ui";
import { WIDGETS, WIDGET_CATEGORIES, type WidgetCategory } from "@/lib/bio-widgets";

export function BlockPicker({ open, onClose, onPick, allowHtml }: { open: boolean; onClose: () => void; onPick: (type: string) => void; allowHtml: boolean }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<WidgetCategory | "all">("all");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return WIDGETS.filter((w) => (cat === "all" || w.category === cat) && (!term || w.label.toLowerCase().includes(term) || w.type.includes(term) || w.description.toLowerCase().includes(term) || (w.keywords ?? "").includes(term)));
  }, [q, cat]);
  return (
    <Modal open={open} onClose={onClose} title="Add a block" wide>
      <div className="flex flex-col gap-3">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input autoFocus className="input pl-9" placeholder="Search widgets (link, video, spotify, form…)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1 flex-wrap text-xs">
          <button type="button" onClick={() => setCat("all")} className={"px-2.5 py-1 rounded-full border " + (cat === "all" ? "bg-primary text-primary-fg border-primary" : "border-border")}>All</button>
          {WIDGET_CATEGORIES.map((c) => <button key={c.key} type="button" onClick={() => setCat(c.key)} className={"px-2.5 py-1 rounded-full border " + (cat === c.key ? "bg-primary text-primary-fg border-primary" : "border-border")}>{c.label}</button>)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[55vh] overflow-auto pr-1">
          {list.map((w) => {
            const locked = w.feature === "customCss" && !allowHtml;
            return (
              <button key={w.type} type="button" onClick={() => { onPick(w.type); onClose(); }} className="text-left rounded-xl border border-border p-3 hover:border-primary hover:bg-primary/5 transition">
                <div className="flex items-center justify-between"><span className="font-medium text-sm">{w.label}</span>{locked && <Lock size={12} className="text-muted" />}</div>
                <p className="text-xs text-muted mt-0.5 line-clamp-2">{w.description}</p>
              </button>
            );
          })}
          {!list.length && <p className="text-sm text-muted col-span-full py-6 text-center">No widgets match your search.</p>}
        </div>
      </div>
    </Modal>
  );
}
