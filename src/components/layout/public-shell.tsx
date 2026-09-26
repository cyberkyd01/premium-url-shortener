import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { Link2 } from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { headers } from "next/headers";
import { getBranding, brandingCss } from "@/lib/whitelabel";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const user = await currentUser();
  const brand = await getBranding(await headers());
  const css = brandingCss(brand);
  const [headerPages, footerPages, languages] = await Promise.all([
    db.page.findMany({ where: { published: true, showInHeader: true }, select: { title: true, slug: true } }),
    db.page.findMany({ where: { published: true, showInFooter: true }, select: { title: true, slug: true } }),
    db.language.findMany({ where: { active: true } }),
  ]);
  const nav = [
    { href: "/features", label: "Features" },
    ...(s["payments.enabled"] === "1" ? [{ href: "/pricing", label: "Pricing" }] : []),
    ...(s["blog.enabled"] === "1" ? [{ href: "/blog", label: "Blog" }] : []),
    ...(s["help.enabled"] === "1" ? [{ href: "/help", label: "Help" }] : []),
    ...headerPages.map((p) => ({ href: `/${p.slug}`, label: p.title })),
  ];
  return (
    <div className="min-h-screen flex flex-col">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {brand.custom && brand.favicon && <link rel="icon" href={brand.favicon} />}
      {s["ads.enabled"] === "1" && s["ads.header"] && <div className="text-center py-2" dangerouslySetInnerHTML={{ __html: s["ads.header"] }} />}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            {brand.logo ? <img src={brand.logo} alt={brand.name} className="h-8" /> : <><span className="h-8 w-8 rounded-lg bg-primary text-primary-fg grid place-items-center"><Link2 size={18} /></span>{brand.name}</>}
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {nav.map((n) => <Link key={n.href} href={n.href} className="text-muted hover:text-fg">{n.label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            {languages.length > 1 && <LanguageSwitcher languages={languages.map((l) => ({ code: l.code, name: l.name, flag: l.flag }))} />}
            <ThemeToggle />
            {user ? (
              <>{user.role === "admin" && <Link href="/admin" className="btn-ghost btn-sm hidden sm:inline-flex">Admin</Link>}<Link href="/dashboard" className="btn-primary btn-sm">Dashboard</Link></>
            ) : (
              <><Link href="/login" className="btn-ghost btn-sm">Login</Link>{s["users.registration"] === "1" && <Link href="/register" className="btn-primary btn-sm">Sign up</Link>}</>
            )}
            <MobileNav items={nav} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {brand.custom && brand.hideBranding ? (
        <footer className="border-t border-border mt-16 py-4 text-center text-xs text-muted">&copy; {new Date().getFullYear()} {brand.name}</footer>
      ) : (
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
          <div className="md:col-span-2">
            <p className="font-bold text-lg mb-2">{brand.name}</p>
            <p className="text-muted max-w-sm">{s["site.tagline"]}</p>
            {s["site.footerText"] && <p className="text-muted mt-3">{s["site.footerText"]}</p>}
          </div>
          <div>
            <p className="font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-muted">
              <li><Link href="/features">Features</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/qr-generator">QR Generator</Link></li>
              {s["bio.enabled"] === "1" && <li><Link href="/bio-pages">Bio Pages Directory</Link></li>}
              {s["plugin.tempmail.domains"] && <li><Link href="/temp-mail">Temp Mail</Link></li>}
              <li><Link href="/developers">Developer API</Link></li>
              <li><Link href="/tools">Tools & Extensions</Link></li>
              {s["affiliate.enabled"] === "1" && <li><Link href="/affiliate">Affiliate Program</Link></li>}
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-3">Company</p>
            <ul className="space-y-2 text-muted">
              {footerPages.map((p) => <li key={p.slug}><Link href={`/${p.slug}`}>{p.title}</Link></li>)}
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/report">Report abuse</Link></li>
              <li><Link href="/sitemap.xml">Sitemap</Link></li>
            </ul>
          </div>
        </div>
        {s["ads.enabled"] === "1" && s["ads.footer"] && <div className="text-center py-2" dangerouslySetInnerHTML={{ __html: s["ads.footer"] }} />}
        <div className="border-t border-border py-4 text-center text-xs text-muted">&copy; {new Date().getFullYear()} {s["site.name"]}. All rights reserved.</div>
      </footer>
      )}
    </div>
  );
}
