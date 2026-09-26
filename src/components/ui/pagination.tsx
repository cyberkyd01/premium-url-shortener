import { cn } from "@/lib/utils";

/** Server-compatible pagination (no client boundary, so callers may pass an href builder). */
export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const items = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => Math.abs(p - page) < 3 || p === 1 || p === pages);
  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      {items.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && items[i - 1] !== p - 1 && <span className="text-muted px-1">…</span>}
          <a href={hrefFor(p)} className={cn("btn-secondary btn-sm", p === page && "bg-primary text-primary-fg border-primary")}>{p}</a>
        </span>
      ))}
    </div>
  );
}
