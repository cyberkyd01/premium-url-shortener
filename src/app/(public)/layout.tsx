import { PublicShell } from "@/components/layout/public-shell";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const user = await currentUser();
  if (s["site.maintenance"] === "1" && user?.role !== "admin") {
    return <div className="min-h-screen grid place-items-center p-6 text-center"><div><h1 className="text-3xl font-bold mb-2">{s["site.name"]}</h1><p className="text-muted">{s["site.maintenanceMessage"]}</p><a href="/login" className="btn-secondary btn-sm mt-6">Admin login</a></div></div>;
  }
  return <PublicShell>{children}</PublicShell>;
}
