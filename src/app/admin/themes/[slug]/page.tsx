import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { json } from "@/lib/utils";
import { Card, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ListEditor, UploadField } from "@/components/admin/fields";
import { LinkTabs } from "@/components/admin/link-tabs";
import { saveThemeSettings, saveThemeEditor } from "../actions";
import { COLOR_SCHEMES, type ThemeConfig } from "@/lib/admin/theme-meta";
import { PaletteField } from "../palette-field";

export default async function ThemePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  await adminPage("themes.manage");
  const { slug } = await params;
  const tab = qs(await searchParams, "tab", "settings");
  const theme = await db.theme.findUnique({ where: { slug } });
  if (!theme) notFound();
  const others = await db.theme.findMany({ where: { NOT: { slug } }, select: { slug: true, name: true } });
  const cfg = json<ThemeConfig>(theme.config, {});
  const overrides = json<Record<string, string>>(theme.overrides, {});
  return (
    <div>
      <PageHeader title={`Theme: ${theme.name}`} description={<span className="font-mono">{theme.slug}{theme.parent ? ` (child of ${theme.parent})` : ""}{theme.active ? " · active" : ""}</span>} actions={<Link href="/admin/themes" className="btn-secondary">← Themes</Link>} />
      <LinkTabs active={tab} tabs={[{ key: "settings", label: "Theme settings", href: `/admin/themes/${slug}` }, { key: "editor", label: "Theme editor", href: `/admin/themes/${slug}?tab=editor` }]} />
      {tab === "settings" ? (
        <ActionForm action={saveThemeSettings} hidden={{ slug }} submitLabel="Save theme settings">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="General">
              <div className="space-y-3">
                <Input label="Name" name="name" defaultValue={theme.name} />
                <Select label="Parent theme (child theme)" name="parent" defaultValue={theme.parent ?? ""} hint="Child themes inherit templates from the parent and only override what they define."><option value="">None (standalone)</option>{others.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}</Select>
                <Select label="Color scheme" name="scheme" defaultValue={cfg.scheme ?? "system"}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></Select>
                <Select label="Homepage variant" name="homepage" defaultValue={cfg.homepage ?? "default"} hint="SaaS: split hero with product mockup, logos, features, steps, stats, pricing, testimonials and FAQ."><option value="default">Default</option><option value="landing">Landing</option><option value="minimal">Minimal</option><option value="saas">SaaS landing</option></Select>
                <Input label="Font family" name="font" defaultValue={cfg.font ?? ""} placeholder="Inter" />
              </div>
            </Card>
            <Card title="Colors & logo" description="Pick a built-in color scheme (light and dark palettes included) or choose Custom to use your own primary and accent colors.">
              <div className="space-y-3">
                <PaletteField schemes={COLOR_SCHEMES.map((c) => ({ key: c.key, label: c.label, description: c.description, swatch: [c.light.primary, c.light.accent, c.dark.bg] }))} defaultValue={cfg.palette && COLOR_SCHEMES.some((c) => c.key === cfg.palette) ? cfg.palette : "custom"} primary={cfg.primary ?? "#6366f1"} accent={cfg.accent ?? "#8b5cf6"} />
                <UploadField name="logo" label="Theme logo (overrides site logo)" defaultValue={cfg.logo ?? ""} folder="themes" />
              </div>
            </Card>
            <Card title="Custom menu items" description="Extra links shown in the public header." className="lg:col-span-2">
              <ListEditor name="menu" fields={[{ key: "label", label: "Label" }, { key: "url", label: "URL", placeholder: "/pricing or https://…" }]} defaultValue={(cfg.menu ?? []).map((m) => ({ label: m.label, url: m.url }))} addLabel="Add menu item" />
            </Card>
          </div>
        </ActionForm>
      ) : (
        <ActionForm action={saveThemeEditor} hidden={{ slug }} submitLabel="Save theme code">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="Custom CSS"><Textarea name="customCss" defaultValue={theme.customCss ?? ""} rows={16} className="[&_textarea]:font-mono [&_textarea]:text-xs" /></Card>
            <Card title="Custom JavaScript"><Textarea name="customJs" defaultValue={theme.customJs ?? ""} rows={16} className="[&_textarea]:font-mono [&_textarea]:text-xs" /></Card>
            <Card title="Template overrides" description='HTML snippets keyed by template name, e.g. "footer.html", "header.html", "home.hero", "splash.html". The public layout renders an override in place of the default markup when present.' className="lg:col-span-2">
              <ListEditor name="overrides" fields={[{ key: "key", label: "Template key", placeholder: "footer.html" }, { key: "html", label: "HTML", type: "textarea" }]} defaultValue={Object.entries(overrides).map(([key, html]) => ({ key, html }))} addLabel="Add override" />
            </Card>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
