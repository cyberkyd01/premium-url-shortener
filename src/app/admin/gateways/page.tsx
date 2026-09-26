import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { qs, type SP } from "@/lib/admin/query";
import { appUrl, json } from "@/lib/utils";
import { GATEWAY_FIELDS, GATEWAY_DOCS, type GatewayField } from "@/lib/admin/gateway-meta";
import { Card, CopyButton, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { SwitchField } from "@/components/admin/fields";
import { LinkTabs } from "@/components/admin/link-tabs";
import { saveGateway } from "./actions";

async function libraryKeys(slug: string): Promise<string[]> {
  try { const { getGateway } = await import("@/lib/payments"); return getGateway(slug)?.configKeys ?? []; } catch { return []; }
}

export default async function GatewaysAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  await adminPage("payments.manage");
  const gateways = await db.paymentGateway.findMany({ orderBy: { name: "asc" } });
  const active = qs(await searchParams, "g", gateways[0]?.slug ?? "stripe");
  const g = gateways.find((x) => x.slug === active) ?? gateways[0];
  if (!g) return <PageHeader title="Payment gateways" description="No gateways seeded. Run the database seed." />;
  const config = json<Record<string, string>>(g.config, {});
  const fields: GatewayField[] = [...(GATEWAY_FIELDS[g.slug] ?? [])];
  for (const k of await libraryKeys(g.slug)) if (!fields.some((f) => f.key === k)) fields.push({ key: k, label: k, secret: /secret|private|key|token|code/i.test(k) });
  const webhook = appUrl(`/api/webhooks/${g.slug}`);
  return (
    <div>
      <PageHeader title="Payment gateways" description="Enable the providers you want to offer at checkout and paste their credentials." />
      <LinkTabs active={g.slug} tabs={gateways.map((x) => ({ key: x.slug, label: `${x.name}${x.enabled ? " ●" : ""}`, href: `/admin/gateways?g=${x.slug}` }))} />
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title={g.name} description={GATEWAY_DOCS[g.slug] ? <a href={GATEWAY_DOCS[g.slug]} target="_blank" rel="noreferrer" className="text-primary">Where to find the credentials ↗</a> : undefined}>
          <ActionForm key={g.slug} action={saveGateway} hidden={{ slug: g.slug, _keys: fields.map((f) => f.key).join(",") }} submitLabel="Save gateway">
            <div className="grid md:grid-cols-2 gap-4">
              <SwitchField name="enabled" label="Enabled" defaultChecked={g.enabled} />
              <Select label="Mode" name="mode" defaultValue={g.mode}><option value="sandbox">Sandbox / test</option><option value="live">Live</option></Select>
            </div>
            {fields.map((f) => f.type === "textarea"
              ? <Textarea key={f.key} label={f.label} name={`c.${f.key}`} defaultValue={config[f.key] ?? ""} hint={f.hint} />
              : f.secret
                ? <div key={f.key}><Input label={f.label} name={`c.${f.key}`} type="password" placeholder={config[f.key] ? "•••••••• (saved, leave blank to keep)" : ""} autoComplete="new-password" hint={f.hint} /><input type="hidden" name={`keep.${f.key}`} value="1" /></div>
                : <Input key={f.key} label={f.label} name={`c.${f.key}`} defaultValue={config[f.key] ?? ""} hint={f.hint} />)}
            {fields.length === 0 && <p className="text-sm text-muted">This gateway needs no credentials.</p>}
          </ActionForm>
        </Card>
        <div className="space-y-4">
          <Card title="Webhook / IPN URL">
            <p className="text-xs text-muted mb-2">Configure this URL in the provider dashboard so payments and subscription events reach the app.</p>
            <div className="flex items-center gap-2"><code className="text-xs break-all flex-1">{webhook}</code><CopyButton text={webhook} /></div>
          </Card>
          <Card title="Status">
            <dl className="text-sm grid grid-cols-2 gap-y-1"><dt className="text-muted">Enabled</dt><dd>{g.enabled ? "yes" : "no"}</dd><dt className="text-muted">Mode</dt><dd>{g.mode}</dd><dt className="text-muted">Configured keys</dt><dd>{Object.keys(config).filter((k) => config[k]).length}</dd></dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
