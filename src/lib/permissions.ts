/** Admin role permission keys (granular roles & permissions system). */
export const ADMIN_PERMISSIONS = [
  { key: "dashboard.view", label: "View admin dashboard" },
  { key: "users.view", label: "View users" },
  { key: "users.manage", label: "Create, edit, ban and delete users" },
  { key: "users.login", label: "Login as user" },
  { key: "roles.manage", label: "Manage roles & permissions" },
  { key: "links.view", label: "View all links" },
  { key: "links.manage", label: "Edit, approve and delete links" },
  { key: "bio.manage", label: "Manage bio pages" },
  { key: "qr.manage", label: "Manage QR codes" },
  { key: "domains.manage", label: "Manage domains" },
  { key: "campaigns.manage", label: "Manage campaigns & channels" },
  { key: "plans.manage", label: "Manage plans, coupons, taxes" },
  { key: "payments.view", label: "View payments & invoices" },
  { key: "payments.manage", label: "Manage payments & gateways" },
  { key: "affiliates.manage", label: "Manage affiliates & payouts" },
  { key: "settings.manage", label: "Manage settings" },
  { key: "languages.manage", label: "Manage languages" },
  { key: "themes.manage", label: "Manage themes & theme editor" },
  { key: "pages.manage", label: "Manage pages" },
  { key: "blog.manage", label: "Manage blog" },
  { key: "help.manage", label: "Manage help center" },
  { key: "testimonials.manage", label: "Manage testimonials & FAQ" },
  { key: "ads.manage", label: "Manage advertisements" },
  { key: "reports.manage", label: "Manage abuse reports" },
  { key: "verification.manage", label: "Manage verification requests" },
  { key: "tools.manage", label: "Tools, cache, cron & updates" },
  { key: "plugins.manage", label: "Manage plugins & marketplace" },
  { key: "integrations.manage", label: "Manage integrations" },
  { key: "notifications.manage", label: "Send announcements & notifications" },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]["key"];

/** Team member permissions. */
export const TEAM_PERMISSIONS = {
  links: ["view", "create", "edit", "delete", "stats"],
  bio: ["view", "create", "edit", "delete"],
  qr: ["view", "create", "edit", "delete"],
  campaigns: ["view", "create", "edit", "delete"],
  pixels: ["view", "create", "edit", "delete"],
  domains: ["view", "create", "edit", "delete"],
  splash: ["view", "create", "edit", "delete"],
  overlays: ["view", "create", "edit", "delete"],
  team: ["manage"],
} as const;

export type TeamPermissions = Partial<Record<keyof typeof TEAM_PERMISSIONS, string[]>>;

export function teamAllows(perms: TeamPermissions, module: keyof typeof TEAM_PERMISSIONS, action: string) {
  const list = perms[module];
  if (!list) return false;
  return list.includes("*") || list.includes(action);
}
