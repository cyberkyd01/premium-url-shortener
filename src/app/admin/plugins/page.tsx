import Link from "next/link";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { json } from "@/lib/utils";
import { PLUGIN_CATALOG, BUILTIN_PLUGINS } from "@/lib/admin/plugin-catalog";
import { getSettings } from "@/lib/settings";
import { revalidatePlugins } from "@/lib/security";
import { SettingInput, type DynamicOptionMap } from "@/components/admin/settings-fields";
import { Card, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { LinkTabs } from "@/components/admin/link-tabs";
import { StatusBadge } from "@/components/admin/table";
import { pluginQuick, savePluginConfig, savePluginSettings, uploadPlugin } from "./actions";

const NO_DYNAMIC: DynamicOptionMap = { languages: [], plans: [], themes: [] };

/** Built-in add-ons ship with the app: make sure each one has a Plugin row (inactive until the admin turns it on). */
async function ensureBuiltinRows() {
  const existing = new Set((await db.plugin.findMany({ where: { slug: { in: BUILTIN_PLUGINS.map((p) => p.slug) } }, select: { slug: true } })).map((p) => p.slug));
  const missing = BUILTIN_PLUGINS.filter((p) => !existing.has(p.slug));
  if (missing.length) await db.$transaction(missing.map((p) => db.plugin.upsert({ where: { slug: p.slug }, create: { slug: p.slug, name: p.name, version: p.version, active: false }, update: {} })));
}

/** "No IP" mirrors the core `misc.anonymousStats` setting: keep the row in sync when the setting was changed elsewhere. */
async function syncNoIpRow(settings: Record<string, string>) {
  const wanted = settings["misc.anonymousStats"] === "1";
  const row = await db.plugin.findUnique({ where: { slug: "noip" }, select: { active: true } });
  if (row && row.active !== wanted) { await db.plugin.update({ where: { slug: "noip" }, data: { active: wanted } }); revalidatePlugins(); }
}

export default async function PluginsAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("plugins.manage");
  const sp = await searchParams;
  const tab = qs(sp, "tab", "installed"), configSlug = qs(sp, "config");
  await ensureBuiltinRows();
  const settings = await getSettings();
  await syncNoIpRow(settings);
  const plugins = await db.plugin.findMany({ orderBy: { name: "asc" } });
  const installed = new Set(plugins.map((p) => p.slug));
  const configuring = plugins.find((p) => p.slug === configSlug);
  const catalogOf = (slug: string) => PLUGIN_CATALOG.find((c) => c.slug === slug);
  return (
    <div>
      <PageHeader title="Plugins & Marketplace" description={`${plugins.length} installed · ${plugins.filter((p) => p.active).length} active`} />
      <LinkTabs active={tab} tabs={[{ key: "installed", label: "Installed", href: "/admin/plugins" }, { key: "marketplace", label: "Marketplace", href: "/admin/plugins?tab=marketplace" }, { key: "upload", label: "Upload plugin", href: "/admin/plugins?tab=upload" }]} />
      {tab === "installed" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid md:grid-cols-2 gap-4">
            {plugins.map((p) => {
              const c = catalogOf(p.slug);
              return (
                <Card key={p.id} title={<>{p.name} <StatusBadge value={p.active} />{c?.builtin && <span className="badge-blue ml-1">Built-in</span>}</>} description={`v${p.version}${c ? ` · ${c.description}` : ""}`}>
                  <div className="flex flex-wrap gap-1">
                    <ActionButton action={pluginQuick} hidden={{ slug: p.slug, op: "toggle" }} variant={p.active ? "secondary" : "primary"} showMessage={false}>{p.active ? "Deactivate" : "Activate"}</ActionButton>
                    {c?.configHref ? <Link href={c.configHref} className="btn-secondary btn-sm">Configure</Link> : <Link href={`/admin/plugins?config=${p.slug}`} className="btn-secondary btn-sm">Configure</Link>}
                    {!c?.builtin && <ActionButton action={pluginQuick} hidden={{ slug: p.slug, op: "uninstall" }} variant="ghost" confirm="Uninstall plugin? Its data is kept." showMessage={false}>Uninstall</ActionButton>}
                  </div>
                </Card>
              );
            })}
            {plugins.length === 0 && <p className="text-sm text-muted">No plugins installed. Browse the marketplace.</p>}
          </div>
          <div>
            {configuring && catalogOf(configuring.slug)?.builtin ? (
              <Card title={`Configure ${configuring.name}`} description={catalogOf(configuring.slug)?.description} actions={<Link href="/admin/plugins" className="btn-ghost btn-sm">Close</Link>}>
                {(() => {
                  const fields = catalogOf(configuring.slug)?.settingsFields ?? [];
                  if (!fields.length) return <p className="text-sm text-muted">{configuring.slug === "noip" ? "No options. While active, visitor IP addresses are never stored in click, bio view or QR scan statistics (mirrors Settings → Misc → \"misc.anonymousStats\")." : "This plugin has no configurable options."}</p>;
                  return (
                    <ActionForm key={configuring.slug} action={savePluginSettings} hidden={{ slug: configuring.slug }} submitLabel="Save">
                      {!configuring.active && <p className="text-xs text-muted">This add-on is inactive: options are saved but not enforced until you activate it.</p>}
                      {fields.map((f) => <SettingInput key={f.key} field={{ key: f.key, label: f.label, type: f.type ?? "text", hint: f.hint, placeholder: f.placeholder }} value={settings[f.key] ?? ""} dynamic={NO_DYNAMIC} />)}
                    </ActionForm>
                  );
                })()}
              </Card>
            ) : configuring ? (
              <Card title={`Configure ${configuring.name}`} actions={<Link href="/admin/plugins" className="btn-ghost btn-sm">Close</Link>}>
                <ActionForm key={configuring.slug} action={savePluginConfig} hidden={{ slug: configuring.slug }} submitLabel="Save">
                  {(() => {
                    const cfg = json<Record<string, string>>(configuring.config, {});
                    const fields: { key: string; label: string; secret?: boolean }[] = catalogOf(configuring.slug)?.configFields ?? Object.keys(cfg).filter((k) => !["uploadedFile", "uploadedAt"].includes(k)).map((k) => ({ key: k, label: k }));
                    return fields.length ? fields.map((f) => f.secret
                      ? <div key={f.key}><Input label={f.label} name={`c.${f.key}`} type="password" placeholder={cfg[f.key] ? "•••••••• (saved)" : ""} /><input type="hidden" name={`keep.${f.key}`} value="1" /></div>
                      : <Input key={f.key} label={f.label} name={`c.${f.key}`} defaultValue={cfg[f.key] ?? ""} />) : <p className="text-sm text-muted">This plugin has no configurable options.</p>;
                  })()}
                </ActionForm>
              </Card>
            ) : <Card title="Configuration"><p className="text-sm text-muted">Select "Configure" on a plugin. Payment plugins are configured under Payment Gateways; Helpdesk under Helpdesk → Settings.</p></Card>}
          </div>
        </div>
      )}
      {tab === "marketplace" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PLUGIN_CATALOG.map((c) => (
            <Card key={c.slug} title={c.name} description={`v${c.version} · ${c.category}${c.builtin ? " · built-in, free" : ""}`}>
              <p className="text-sm text-muted mb-3">{c.description}</p>
              {installed.has(c.slug) ? <span className="badge-green">Installed</span> : <ActionButton action={pluginQuick} hidden={{ slug: c.slug, op: "install" }} variant="primary" showMessage={false}>Install</ActionButton>}
            </Card>
          ))}
        </div>
      )}
      {tab === "upload" && (
        <Card title="Upload plugin" description="Upload a plugin manifest (plugin.json: {slug, name, version, config}) or a zip package. Only metadata is stored; plugin code must be deployed with the app." className="max-w-xl">
          <ActionForm action={uploadPlugin} submitLabel="Upload" variant="secondary"><Input type="file" name="file" accept=".json,.zip,application/json,application/zip" required /></ActionForm>
        </Card>
      )}
    </div>
  );
}
