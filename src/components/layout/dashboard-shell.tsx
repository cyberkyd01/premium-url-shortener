import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentDbUser } from "@/lib/auth";
import { getUserPlan } from "@/lib/plan";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SidebarNav } from "./sidebar-nav";
import { TopbarUser } from "./topbar-user";
import { CommandPalette } from "./command-palette";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await currentDbUser();
  if (!user) redirect("/login");
  const s = await getSettings();
  const { plan, features } = await getUserPlan(user.id);
  const [channels, teams, unread] = await Promise.all([
    db.channel.findMany({ where: { userId: user.id, starred: true }, orderBy: { name: "asc" } }),
    db.teamMember.findMany({ where: { userId: user.id }, include: { team: true } }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  const activeTeam = user.activeTeamId ? teams.find((t) => t.teamId === user.activeTeamId)?.team ?? null : null;
  const groups = [
    { title: "", items: [{ href: "/dashboard", label: "Overview", icon: "LayoutDashboard" }, { href: "/dashboard/links", label: "Links", icon: "Link2" }, { href: "/dashboard/links/new", label: "Shorten link", icon: "Plus" }, { href: "/dashboard/notifications", label: "Notifications", icon: "Bell", badge: unread || undefined }] },
    { title: "Organize", items: [
      { href: "/dashboard/channels", label: "Channels", icon: "FolderOpen" },
      { href: "/dashboard/campaigns", label: "Campaigns", icon: "Megaphone" },
      ...(s["bio.enabled"] === "1" ? [{ href: "/dashboard/bio", label: "Bio Pages", icon: "UserCircle" }] : []),
      ...(s["qr.enabled"] === "1" ? [{ href: "/dashboard/qr", label: "QR Codes", icon: "QrCode" }] : []),
      { href: "/dashboard/files", label: "Files", icon: "FileUp" },
    ] },
    { title: "Analytics", items: [
      { href: "/dashboard/live", label: "Live Analytics", icon: "Radio" },
      { href: "/dashboard/health", label: "Link Health", icon: "HeartPulse" },
      { href: "/dashboard/reports", label: "Reports & Sharing", icon: "BarChart3" },
    ] },
    { title: "Tools", items: [
      { href: "/dashboard/pixels", label: "Pixels", icon: "Target" },
      { href: "/dashboard/splash", label: "Splash Pages", icon: "Presentation" },
      { href: "/dashboard/overlays", label: "Overlays", icon: "MessageSquare" },
      { href: "/dashboard/domains", label: "Custom Domains", icon: "Globe" },
      { href: "/dashboard/parameters", label: "Parameter Templates", icon: "SlidersHorizontal" },
      { href: "/dashboard/import", label: "Import / Export", icon: "Upload" },
      { href: "/dashboard/migrate", label: "Migrate links", icon: "ArrowRightLeft" },
      { href: "/dashboard/webhooks", label: "Webhook Logs", icon: "Webhook" },
      { href: "/dashboard/sms", label: "Send SMS", icon: "MessageCircle" },
      { href: "/dashboard/tools", label: "Integrations", icon: "Puzzle" },
      ...(s["ai.enabled"] === "1" ? [{ href: "/dashboard/ai", label: "AI Copilot", icon: "Sparkles" }] : []),
      ...((s["plugin.tempmail.domains"] ?? "").trim() ? [{ href: "/dashboard/temp-mail", label: "Temp Mail", icon: "MailOpen" }] : []),
    ] },
    { title: "Account", items: [
      ...(s["teams.enabled"] === "1" ? [{ href: "/dashboard/teams", label: "Teams", icon: "Users" }] : []),
      ...(s["affiliate.enabled"] === "1" ? [{ href: "/dashboard/affiliate", label: "Affiliate", icon: "HandCoins" }] : []),
      ...(s["payments.enabled"] === "1" ? [{ href: "/dashboard/billing", label: "Billing & Plans", icon: "CreditCard" }] : []),
      { href: "/dashboard/activity", label: "Activity Log", icon: "Activity" },
      { href: "/dashboard/support", label: "Support", icon: "LifeBuoy" },
      { href: "/dashboard/settings", label: "Settings", icon: "Settings" },
    ] },
  ];
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card fixed inset-y-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link href="/" className="font-bold text-lg truncate">{s["site.logo"] ? <img src={s["site.logo"]} alt="" className="h-8" /> : s["site.name"]}</Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav groups={groups} channels={channels.map((c) => ({ id: c.id, name: c.name, color: c.color }))} />
        </div>
        <div className="p-4 border-t border-border text-xs text-muted">
          <p className="font-medium text-fg">{plan?.name ?? "Free"} plan</p>
          {user.planExpires && !plan?.isFree && <p>Renews {formatDate(user.planExpires)}</p>}
          {s["payments.enabled"] === "1" && <Link href="/dashboard/billing" className="text-primary">Upgrade</Link>}
        </div>
      </aside>
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 gap-3">
          <CommandPalette />
          <div className="flex-1" />
          <ThemeToggle />
          <TopbarUser user={{ name: user.name ?? user.username, email: user.email, avatar: user.avatar, role: user.role, gravatar: user.gravatar && s["users.gravatar"] === "1" }} unread={unread} teams={teams.map((t) => ({ id: t.teamId, name: t.team.name }))} activeTeamId={activeTeam?.id ?? null} />
        </header>
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in">
          {user.status === 2 && <div className="mb-4 rounded-lg bg-warning/10 text-warning px-4 py-3 text-sm">Please verify your email address. <Link href="/dashboard/settings?resend=1" className="underline">Resend verification email</Link></div>}
          {!features && null}
          {children}
        </main>
      </div>
    </div>
  );
}
