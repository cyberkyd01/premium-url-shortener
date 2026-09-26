import Link from "next/link";
import { redirect } from "next/navigation";
import { currentDbUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TopbarUser } from "./topbar-user";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await currentDbUser();
  if (!user || user.role !== "admin") redirect("/dashboard");
  const s = await getSettings();
  const [pendingLinks, pendingReports, pendingVerifs, pendingPayouts, openTickets] = await Promise.all([
    db.link.count({ where: { status: "pending" } }), db.report.count({ where: { status: "pending" } }),
    db.verificationRequest.count({ where: { status: "pending" } }), db.affiliatePayout.count({ where: { status: "pending" } }),
    db.ticket.count({ where: { status: "open" } }),
  ]);
  const groups = [
    { title: "", items: [{ href: "/admin", label: "Dashboard", icon: "LayoutDashboard" }] },
    { title: "Manage", items: [
      { href: "/admin/users", label: "Users", icon: "Users" }, { href: "/admin/roles", label: "Roles & Permissions", icon: "ShieldCheck" },
      { href: "/admin/verifications", label: "Verifications", icon: "BadgeCheck", badge: pendingVerifs || undefined },
      { href: "/admin/links", label: "Links", icon: "Link2", badge: pendingLinks || undefined }, { href: "/admin/bio", label: "Bio Pages", icon: "UserCircle" },
      { href: "/admin/qr", label: "QR Codes", icon: "QrCode" }, { href: "/admin/domains", label: "Domains", icon: "Globe" },
      { href: "/admin/campaigns", label: "Campaigns", icon: "Megaphone" }, { href: "/admin/reports", label: "Reports", icon: "Flag", badge: pendingReports || undefined },
      { href: "/admin/files", label: "Hosted Files", icon: "FileUp" },
    ] },
    { title: "Membership", items: [
      { href: "/admin/plans", label: "Plans", icon: "Layers" }, { href: "/admin/coupons", label: "Coupons & Vouchers", icon: "Ticket" },
      { href: "/admin/taxes", label: "Tax Rates", icon: "Percent" }, { href: "/admin/payments", label: "Payments & Invoices", icon: "Receipt" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: "RefreshCw" }, { href: "/admin/gateways", label: "Payment Gateways", icon: "CreditCard" },
      { href: "/admin/affiliates", label: "Affiliates", icon: "HandCoins", badge: pendingPayouts || undefined },
    ] },
    { title: "Content", items: [
      { href: "/admin/pages", label: "Pages", icon: "FileText" }, { href: "/admin/blog", label: "Blog", icon: "Newspaper" },
      { href: "/admin/help", label: "Help Center", icon: "LifeBuoy" }, { href: "/admin/testimonials", label: "Testimonials & FAQ", icon: "Quote" },
      { href: "/admin/announcements", label: "Announcements", icon: "Bell" }, { href: "/admin/ads", label: "Advertisements", icon: "BadgeDollarSign" },
      { href: "/admin/tickets", label: "Helpdesk", icon: "Inbox", badge: openTickets || undefined }, { href: "/admin/contacts", label: "Contact Messages", icon: "Mail" },
    ] },
    { title: "Premium", items: [
      { href: "/admin/activity", label: "Activity Log", icon: "Activity" }, { href: "/admin/health", label: "Link Health", icon: "HeartPulse" },
      { href: "/admin/conversions", label: "Conversions", icon: "Goal" }, { href: "/admin/shared-reports", label: "Shared Reports", icon: "Share2" },
      { href: "/admin/webhook-logs", label: "Webhook Logs", icon: "Webhook" }, { href: "/admin/migrations", label: "Migrations", icon: "DatabaseZap" },
      { href: "/dashboard/live", label: "Live Clicks", icon: "Radio" },
    ] },
    { title: "System", items: [
      { href: "/admin/settings", label: "Settings", icon: "Settings" }, { href: "/admin/languages", label: "Languages", icon: "Languages" },
      { href: "/admin/themes", label: "Themes", icon: "Palette" }, { href: "/admin/plugins", label: "Plugins & Marketplace", icon: "Puzzle" },
      { href: "/admin/integrations", label: "Integrations", icon: "Plug" }, { href: "/admin/emails", label: "Email Templates", icon: "MailOpen" },
      { href: "/admin/cron", label: "Cron Jobs", icon: "Clock" }, { href: "/admin/tools", label: "Tools & Cache", icon: "Wrench" },
      { href: "/admin/cloudflare", label: "Cloudflare SSL", icon: "CloudCog" }, { href: "/admin/temp-mail", label: "Temp Mail", icon: "MailOpen" },
      { href: "/admin/update", label: "Update", icon: "Download" },
    ] },
  ];
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card fixed inset-y-0">
        <div className="h-16 flex items-center px-5 border-b border-border font-bold"><Link href="/admin">{s["site.name"]} <span className="badge-blue ml-1">Admin</span></Link></div>
        <div className="flex-1 overflow-y-auto p-3"><SidebarNav groups={groups} /></div>
        <div className="p-3 border-t border-border"><Link href="/dashboard" className="btn-secondary btn-sm w-full">← User dashboard</Link></div>
      </aside>
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 gap-3">
          <div className="flex-1" /><ThemeToggle />
          <TopbarUser user={{ name: user.name ?? user.username, email: user.email, avatar: user.avatar, role: user.role, gravatar: user.gravatar }} unread={0} teams={[]} activeTeamId={null} />
        </header>
        <main className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in">{children}</main>
      </div>
    </div>
  );
}
