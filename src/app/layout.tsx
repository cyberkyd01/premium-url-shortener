import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { ChatWidget } from "@/components/layout/chat-widget";
import { Announcements } from "@/components/layout/announcements";
import { currentUser } from "@/lib/auth";
import { json } from "@/lib/utils";
import { themeCss, type ThemeConfig } from "@/lib/admin/theme-meta";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s["seo.title"] || s["site.name"], template: `%s · ${s["site.name"]}` },
    description: s["seo.description"] || s["site.description"],
    keywords: s["seo.keywords"] || undefined,
    openGraph: { siteName: s["site.name"], images: s["site.ogImage"] ? [s["site.ogImage"]] : undefined },
    icons: s["site.favicon"] ? { icon: s["site.favicon"], apple: "/icons/apple-touch-icon.png" } : { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: s["site.name"] },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const user = await currentUser();
  const theme = await db.theme.findFirst({ where: { active: true } }).catch(() => null);
  const scheme = s["site.colorScheme"];
  const themeCfg = json<ThemeConfig>(theme?.config, {});
  // Built-in color palette (config.palette) → full light/dark variable set; otherwise primary/accent/font overrides.
  const themeVars = themeCss(themeCfg);
  const announcements = await db.announcement.findMany({ where: { active: true, target: { in: ["all", user ? "users" : "guests", ...(user?.role === "admin" ? ["admin"] : [])] } }, orderBy: { createdAt: "desc" } }).catch(() => []);
  return (
    <html lang={s["site.defaultLanguage"] || "en"} suppressHydrationWarning className={scheme === "dark" ? "dark" : ""}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        {scheme === "system" && <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}` }} />}
        <meta name="theme-color" content="#6366f1" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0b1120" media="(prefers-color-scheme: dark)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={s["site.name"]} />
        {themeVars && <style dangerouslySetInnerHTML={{ __html: themeVars }} />}
        {theme?.customCss && <style dangerouslySetInnerHTML={{ __html: theme.customCss }} />}
        {s["site.customCss"] && <style dangerouslySetInnerHTML={{ __html: s["site.customCss"] }} />}
        {s["site.headCode"] && <div dangerouslySetInnerHTML={{ __html: s["site.headCode"] }} />}
      </head>
      <body className="min-h-screen">
        <Announcements items={announcements.map((a) => ({ id: a.id, title: a.title, content: a.content, type: a.type, dismissible: a.dismissible }))} />
        {children}
        {s["cookie.consent"] === "1" && <CookieConsent text={s["cookie.text"]} />}
        <ChatWidget provider={s["chat.provider"]} id={s["chat.id"]} />
        {s["analytics.code"] && <div dangerouslySetInnerHTML={{ __html: s["analytics.code"] }} />}
        {s["site.footerCode"] && <div dangerouslySetInnerHTML={{ __html: s["site.footerCode"] }} />}
        {(theme?.customJs || s["site.customJs"]) && <script dangerouslySetInnerHTML={{ __html: (theme?.customJs ?? "") + "\n" + (s["site.customJs"] ?? "") }} />}
        {process.env.NODE_ENV === "production" && <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})})}` }} />}
      </body>
    </html>
  );
}
