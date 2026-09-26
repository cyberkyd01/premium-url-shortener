import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export function GET() {
  const lines = [
    "User-agent: *",
    "Disallow: /admin", "Disallow: /dashboard", "Disallow: /api/", "Disallow: /checkout", "Disallow: /login", "Disallow: /register",
    "Disallow: /logout", "Disallow: /forgot", "Disallow: /reset/", "Disallow: /verify/", "Disallow: /invite/", "Disallow: /stats/", "Disallow: /domain-check",
    "Allow: /",
    "",
    `Sitemap: ${appUrl("/sitemap.xml")}`,
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
