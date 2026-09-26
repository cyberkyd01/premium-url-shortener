"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button className="btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
      {open && <div className="absolute left-0 right-0 top-16 bg-card border-b border-border p-4 flex flex-col gap-3 text-sm">{items.map((n) => <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</Link>)}</div>}
    </div>
  );
}
