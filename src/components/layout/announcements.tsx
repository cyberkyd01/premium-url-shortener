"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
export function Announcements({ items }: { items: { id: string; title: string; content: string; type: string; dismissible: boolean }[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => { try { setHidden(JSON.parse(localStorage.getItem("ann-hidden") || "[]")); } catch {} }, []);
  const visible = items.filter((i) => !hidden.includes(i.id));
  if (!visible.length) return null;
  const colors: Record<string, string> = { info: "bg-primary text-primary-fg", warning: "bg-warning text-white", success: "bg-success text-white" };
  return (
    <div>
      {visible.map((a) => (
        <div key={a.id} className={`px-4 py-2 text-sm flex items-center gap-3 ${colors[a.type] ?? colors.info}`}>
          <span className="flex-1"><strong>{a.title}</strong> {a.content}</span>
          {a.dismissible && <button onClick={() => { const h = [...hidden, a.id]; setHidden(h); try { localStorage.setItem("ann-hidden", JSON.stringify(h)); } catch {} }}><X size={14} /></button>}
        </div>
      ))}
    </div>
  );
}
