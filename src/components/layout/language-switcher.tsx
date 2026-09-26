"use client";
import { Globe } from "lucide-react";
export function LanguageSwitcher({ languages, current }: { languages: { code: string; name: string; flag?: string | null }[]; current?: string }) {
  return (
    <label className="inline-flex items-center gap-1 text-sm text-muted">
      <Globe size={14} />
      <select className="bg-transparent outline-none cursor-pointer" defaultValue={current ?? ""} onChange={(e) => { document.cookie = `lang=${e.target.value};path=/;max-age=31536000`; const u = new URL(location.href); u.searchParams.set("lang", e.target.value); location.href = u.toString(); }}>
        <option value="" disabled>Language</option>
        {languages.map((l) => <option key={l.code} value={l.code}>{l.flag ? l.flag + " " : ""}{l.name}</option>)}
      </select>
    </label>
  );
}
