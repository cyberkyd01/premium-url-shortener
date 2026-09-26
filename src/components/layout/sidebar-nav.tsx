"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem { href: string; label: string; icon: string; badge?: number }
export function SidebarNav({ groups, channels }: { groups: { title: string; items: NavItem[] }[]; channels?: { id: string; name: string; color: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <p className="px-3 mb-1 text-[11px] uppercase tracking-wider text-muted font-semibold">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>)[it.icon] ?? Icons.Circle;
              const active = it.href === "/dashboard" || it.href === "/admin" ? pathname === it.href : pathname.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={cn("nav-item", active && "active")}>
                  <Icon size={16} /><span className="flex-1">{it.label}</span>
                  {it.badge ? <span className="badge-blue">{it.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {channels && channels.length > 0 && (
        <div>
          <p className="px-3 mb-1 text-[11px] uppercase tracking-wider text-muted font-semibold">Starred channels</p>
          {channels.map((c) => <Link key={c.id} href={`/dashboard/channels/${c.id}`} className="nav-item"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</Link>)}
        </div>
      )}
    </nav>
  );
}
