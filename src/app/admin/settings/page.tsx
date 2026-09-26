import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { qs, type SP } from "@/lib/admin/query";
import { appUrl } from "@/lib/utils";
import { SETTINGS_TABS, tabWithFallback } from "@/lib/admin/settings-schema";
import { Card, CopyButton, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { LinkTabs } from "@/components/admin/link-tabs";
import { SettingInput, type DynamicOptionMap } from "@/components/admin/settings-fields";
import { saveSettingsTab, sendTestEmail, clearCacheAction, syncUploads } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("settings.manage");
  const key = qs(await searchParams, "tab", "general");
  const tab = tabWithFallback(SETTINGS_TABS.find((t) => t.key === key) ?? SETTINGS_TABS[0]);
  const [s, languages, plans, themes] = await Promise.all([getSettings(), db.language.findMany({ where: { active: true } }), db.plan.findMany({ orderBy: { sortOrder: "asc" } }), db.theme.findMany()]);
  const dynamic: DynamicOptionMap = {
    languages: languages.length ? languages.map((l) => ({ value: l.code, label: l.name })) : [{ value: "en", label: "English" }],
    plans: [{ value: "", label: "Free plan (auto)" }, ...plans.map((p) => ({ value: p.id, label: p.name }))],
    themes: themes.length ? themes.map((t) => ({ value: t.slug, label: t.name })) : [{ value: "default", label: "Default" }],
  };
  const social = [["Google", "google"], ["Facebook", "facebook"], ["X / Twitter", "twitter"]];
  return (
    <div>
      <PageHeader title="Settings" description="All platform settings. Secrets are never displayed once saved; leave them blank to keep the stored value." />
      <LinkTabs active={tab.key} tabs={SETTINGS_TABS.map((t) => ({ key: t.key, label: t.label, href: `/admin/settings?tab=${t.key}` }))} />
      <ActionForm key={tab.key} action={saveSettingsTab} hidden={{ tab: tab.key }} submitLabel="Save settings">
        <div className="grid lg:grid-cols-2 gap-4">
          {tab.sections.map((sec) => (
            <Card key={sec.title} title={sec.title} description={sec.description} className={sec.fields.some((f) => f.type === "code" || f.type === "textarea") ? "lg:col-span-2" : undefined}>
              <div className="space-y-4">
                {sec.fields.map((f) => <SettingInput key={f.key} field={f} value={s[f.key] ?? ""} dynamic={dynamic} />)}
                {sec.extra === "social" && (
                  <div className="rounded-lg bg-bg p-3 text-xs space-y-1">
                    <p className="font-medium">OAuth callback URLs (paste into each provider console):</p>
                    {social.map(([name, slug]) => <div key={slug} className="flex items-center gap-2"><span className="w-24 text-muted">{name}</span><code className="flex-1 break-all">{appUrl(`/api/auth/callback/${slug}`)}</code><CopyButton text={appUrl(`/api/auth/callback/${slug}`)} /></div>)}
                    <p className="text-muted">Env vars: GOOGLE_CLIENT_ID/SECRET, FACEBOOK_CLIENT_ID/SECRET, TWITTER_CLIENT_ID/SECRET.</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ActionForm>
      {tab.sections.some((x) => x.extra === "mailTest") && (
        <Card title="Send test email" className="mt-6 max-w-xl"><ActionForm action={sendTestEmail} submitLabel="Send test" variant="secondary"><Input label="Recipient" name="to" type="email" placeholder="your@email.com (defaults to your account)" /></ActionForm></Card>
      )}
      {tab.sections.some((x) => x.extra === "clearCache") && (
        <Card title="Clear cache" description="Revalidates settings, translations and every cached page." className="mt-6 max-w-xl"><ActionButton action={clearCacheAction} variant="secondary" size={undefined}>Clear cache now</ActionButton></Card>
      )}
      {tab.sections.some((x) => x.extra === "storageSync") && (
        <Card title="Sync uploads to storage" description="Copies every file under public/uploads to the configured bucket (same paths). Save the storage settings first." className="mt-6 max-w-xl"><ActionButton action={syncUploads} variant="secondary" size={undefined} confirm="Upload all local files to the bucket?">Sync uploads</ActionButton></Card>
      )}
    </div>
  );
}
