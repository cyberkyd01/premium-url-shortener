import { notFound } from "next/navigation";
import { adminPage } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { planFeatures, DEFAULT_FEATURES, ALL_REDIRECT_TYPES, ALL_QR_TYPES, type PlanFeatures } from "@/lib/plan";
import { FEATURE_LABELS, LIMIT_FIELDS, GATEWAY_ID_FIELDS } from "@/lib/admin/plan-meta";
import { Card, Input, PageHeader, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { ActionButton } from "@/components/admin/action-button";
import { SwitchField, CheckboxGroup, LimitField } from "@/components/admin/fields";
import { savePlan, deletePlan } from "../actions";
import type { Plan } from "@prisma/client";

export default async function PlanForm({ params }: { params: Promise<{ id: string }> }) {
  await adminPage("plans.manage");
  const { id } = await params;
  const plan = id === "new" ? null : await db.plan.findUnique({ where: { id } });
  if (id !== "new" && !plan) notFound();
  const f = plan ? planFeatures(plan) : { ...DEFAULT_FEATURES };
  const rec = (plan ?? {}) as unknown as Record<string, number | string | null>;
  const boolKeys = (Object.keys(DEFAULT_FEATURES) as (keyof PlanFeatures)[]).filter((k) => typeof DEFAULT_FEATURES[k] === "boolean");
  return (
    <div>
      <PageHeader title={plan ? `Edit plan: ${plan.name}` : "Create plan"} actions={plan && <ActionButton action={deletePlan} hidden={{ id: plan.id }} variant="danger" confirm="Delete this plan? Users on it are moved to the free plan.">Delete plan</ActionButton>} />
      <ActionForm action={savePlan} hidden={plan ? { id: plan.id } : undefined} submitLabel={plan ? "Save plan" : "Create plan"}>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="General">
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Name" name="name" defaultValue={plan?.name ?? ""} required />
              <Input label="Slug" name="slug" defaultValue={plan?.slug ?? ""} />
              <Input label="Monthly price" name="priceMonthly" type="number" step="0.01" defaultValue={plan?.priceMonthly ?? 0} />
              <Input label="Yearly price" name="priceYearly" type="number" step="0.01" defaultValue={plan?.priceYearly ?? 0} />
              <Input label="Lifetime price" name="priceLifetime" type="number" step="0.01" defaultValue={plan?.priceLifetime ?? 0} hint="0 disables lifetime" />
              <Input label="Currency" name="currency" defaultValue={plan?.currency ?? "USD"} />
              <Input label="Sort order" name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} />
              <Input label="Trial days" name="trialDays" type="number" defaultValue={plan?.trialDays ?? 0} />
            </div>
            <Textarea label="Description" name="description" defaultValue={plan?.description ?? ""} className="mt-4" />
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <SwitchField name="isFree" label="Free plan" defaultChecked={plan?.isFree} />
              <SwitchField name="isPublic" label="Public (shown on pricing)" defaultChecked={plan?.isPublic ?? true} />
              <SwitchField name="isFeatured" label="Featured" defaultChecked={plan?.isFeatured} />
            </div>
          </Card>
          <Card title="Limits" description="-1 = unlimited, 0 = not available">
            <div className="grid md:grid-cols-2 gap-3">
              {LIMIT_FIELDS.map((l) => <LimitField key={l.key} name={l.key} label={l.label} defaultValue={typeof rec[l.key] === "number" ? (rec[l.key] as number) : (l.key === "limitLinks" || l.key.includes("Monthly") || l.key === "limitClicks" || l.key === "limitCoupons" || l.key === "limitChannels" ? -1 : 0)} />)}
            </div>
          </Card>
          <Card title="Features">
            <div className="grid md:grid-cols-2 gap-3">
              {boolKeys.map((k) => <SwitchField key={k} name={`f.${k}`} label={FEATURE_LABELS[k]} defaultChecked={!!f[k]} />)}
            </div>
            <div className="mt-4 space-y-4">
              <CheckboxGroup name="f.redirectTypes" label={FEATURE_LABELS.redirectTypes} options={ALL_REDIRECT_TYPES.map((t) => ({ value: t, label: t }))} defaultValues={f.redirectTypes} />
              <CheckboxGroup name="f.qrTypes" label={FEATURE_LABELS.qrTypes} options={ALL_QR_TYPES.map((t) => ({ value: t, label: t }))} defaultValues={f.qrTypes} columns={4} />
              <Input label={FEATURE_LABELS.statsRetentionDays} name="f.statsRetentionDays" type="number" defaultValue={f.statsRetentionDays} className="max-w-xs" />
            </div>
          </Card>
          <Card title="Gateway identifiers" description="Filled by 'Sync plans' on the Plans page (read-only).">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {GATEWAY_ID_FIELDS.map((g) => <div key={g.key} className="contents"><dt className="text-muted">{g.label}</dt><dd className="font-mono text-xs truncate">{(plan as Plan | null)?.[g.key as keyof Plan]?.toString() || "-"}</dd></div>)}
            </dl>
          </Card>
        </div>
      </ActionForm>
    </div>
  );
}
