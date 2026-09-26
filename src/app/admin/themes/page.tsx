import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { json } from "@/lib/utils";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { themeQuick, uploadTheme } from "./actions";
import type { ThemeConfig } from "@/lib/admin/theme-meta";

export default async function ThemesAdmin() {
  await adminPage("themes.manage");
  const [themes, s] = await Promise.all([db.theme.findMany({ orderBy: { name: "asc" } }), getSettings()]);
  return (
    <div>
      <PageHeader title="Themes" description={`Active theme: ${s["site.theme"]} · color scheme: ${s["site.colorScheme"]} · homepage: ${s["site.homepage"]}`} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {themes.map((t) => {
          const cfg = json<ThemeConfig>(t.config, {});
          return (
            <div key={t.id} className={`card overflow-hidden ${t.active ? "border-primary" : ""}`}>
              <div className="h-24 flex items-end p-3" style={{ background: `linear-gradient(135deg, ${cfg.primary ?? "#6366f1"}, ${cfg.accent ?? "#8b5cf6"})` }}><span className="text-white font-semibold drop-shadow">{t.name}</span></div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="font-mono text-xs text-muted">{t.slug}{t.parent ? ` · child of ${t.parent}` : ""}</span>{t.active && <span className="badge-green">active</span>}</div>
                <p className="text-xs text-muted">Scheme: {cfg.scheme ?? "system"} · Homepage: {cfg.homepage ?? "default"} · {Object.keys(json<Record<string, string>>(t.overrides, {})).length} overrides</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {!t.active && <ActionButton action={themeQuick} hidden={{ id: t.id, op: "activate" }} variant="primary" showMessage={false}>Activate</ActionButton>}
                  <Link href={`/admin/themes/${t.slug}`} className="btn-secondary btn-sm">Settings</Link>
                  <Link href={`/admin/themes/${t.slug}?tab=editor`} className="btn-secondary btn-sm">Editor</Link>
                  <ActionButton action={themeQuick} hidden={{ id: t.id, op: "clone" }} showMessage={false}>Clone</ActionButton>
                  <a href={`/api/admin/export?theme=${t.slug}`} className="btn-ghost btn-sm">Export</a>
                  {t.slug !== "default" && !t.active && <ActionButton action={themeQuick} hidden={{ id: t.id, op: "delete" }} variant="danger" confirm="Delete this theme?" showMessage={false}>Delete</ActionButton>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Card title="Install theme" description="Upload a theme JSON file (exported from this or another installation). Zip packages: unzip and upload the theme.json inside." className="max-w-xl">
        <ActionForm action={uploadTheme} submitLabel="Install" variant="secondary"><Input type="file" name="file" accept="application/json,.json,.zip" required /></ActionForm>
      </Card>
    </div>
  );
}
