import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("max-w-6xl mx-auto px-4 py-16", className)}>{children}</section>;
}

export function SectionTitle({ eyebrow, title, description, center = true }: { eyebrow?: string; title: ReactNode; description?: ReactNode; center?: boolean }) {
  return (
    <div className={cn("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">{eyebrow}</p>}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      {description && <p className="text-muted mt-3 text-base md:text-lg">{description}</p>}
    </div>
  );
}

export function FeatureCard({ icon, title, description }: { icon?: ReactNode; title: string; description: ReactNode }) {
  return (
    <div className="card p-5 h-full">
      {icon && <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3">{icon}</div>}
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted leading-6">{description}</p>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted mb-4">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? <a href={it.href} className="hover:text-fg">{it.label}</a> : <span className="text-fg">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
