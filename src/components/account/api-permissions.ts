/** API key permission scopes. `users.*` is admin-only. */
export interface ApiPermission { key: string; label: string; adminOnly?: boolean }
export const API_PERMISSIONS: readonly ApiPermission[] = [
  { key: "links.read", label: "Links: read" }, { key: "links.write", label: "Links: write" },
  { key: "bio.read", label: "Bio pages: read" }, { key: "bio.write", label: "Bio pages: write" },
  { key: "qr.read", label: "QR codes: read" }, { key: "qr.write", label: "QR codes: write" },
  { key: "campaigns.read", label: "Campaigns: read" }, { key: "campaigns.write", label: "Campaigns: write" },
  { key: "pixels.read", label: "Pixels: read" }, { key: "pixels.write", label: "Pixels: write" },
  { key: "domains.read", label: "Domains: read" }, { key: "domains.write", label: "Domains: write" },
  { key: "splash.read", label: "Splash pages: read" }, { key: "splash.write", label: "Splash pages: write" },
  { key: "overlays.read", label: "Overlays: read" }, { key: "overlays.write", label: "Overlays: write" },
  { key: "account.read", label: "Account: read" }, { key: "account.write", label: "Account: write" },
  { key: "users.read", label: "Users: read (admin)", adminOnly: true }, { key: "users.write", label: "Users: write (admin)", adminOnly: true },
];
