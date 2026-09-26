import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-side tab bar using links (active key passed in). */
export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; badge?: number }[]; active: string }) {
  return (
    <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={cn("px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap flex items-center gap-1", active === t.key ? "border-primary text-primary font-medium" : "border-transparent text-muted hover:text-fg")}>
          {t.label}{t.badge ? <span className="badge-blue">{t.badge}</span> : null}
        </Link>
      ))}
    </div>
  );
}
