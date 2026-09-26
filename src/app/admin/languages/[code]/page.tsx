import Link from "next/link";
import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import en from "@/locales/en.json";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { TranslationTable } from "@/components/admin/translation-table";
import { saveTranslations, autofillTranslations, importTranslations } from "../actions";

export default async function TranslateLanguage({ params }: { params: Promise<{ code: string }> }) {
  await adminPage("languages.manage");
  const { code } = await params;
  const lang = await db.language.findUnique({ where: { code }, include: { strings: true } });
  if (!lang) notFound();
  const EN = en as Record<string, string>;
  const existing = new Map(lang.strings.map((s) => [s.key, s.value]));
  const keys = Array.from(new Set([...Object.keys(EN), ...existing.keys()])).sort();
  const rows = keys.map((key) => ({ key, en: EN[key] ?? "", value: existing.get(key) ?? "" }));
  const missing = rows.filter((r) => !r.value).length;
  return (
    <div>
      <PageHeader title={<>{lang.flag} {lang.name} <span className="text-muted font-normal text-base">({code})</span></>} description={`${rows.length - missing} translated · ${missing} missing`}
        actions={<>
          <Link href="/admin/languages" className="btn-secondary">← Languages</Link>
          <a href={`/api/admin/languages/${code}/export`} className="btn-secondary">Export JSON</a>
          <ActionButton action={autofillTranslations} hidden={{ code }} size={undefined} confirm="Copy the English text into every missing string?">Auto-fill missing with English</ActionButton>
        </>} />
      <TranslationTable action={saveTranslations} code={code} rows={rows} />
      <Card title="Import language pack" description="Upload a JSON file exported from another installation (or paste JSON). Keys are merged into this language." className="mt-6 max-w-2xl">
        <ActionForm action={importTranslations} hidden={{ code }} submitLabel="Import" variant="secondary">
          <input type="file" name="file" accept="application/json,.json" className="input" />
          <Textarea name="json" placeholder='{"nav.home": "Accueil", …}' className="[&_textarea]:font-mono [&_textarea]:text-xs" />
        </ActionForm>
      </Card>
    </div>
  );
}
