import Link from "next/link";
import type { Plan } from "@prisma/client";
import { Check } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { planFeatures } from "@/lib/plan";

const FEATURE_LABELS: Array<[keyof ReturnType<typeof planFeatures>, string]> = [
  ["customAlias", "Custom aliases"], ["password", "Password protection"], ["expiration", "Link expiration"], ["geoTargeting", "Geo targeting"], ["deviceTargeting", "Device targeting"],
  ["abTesting", "A/B testing"], ["deepLinks", "Deep links"], ["api", "API access"], ["webhooks", "Webhooks & Zapier"], ["teams", "Teams"], ["aiCopilot", "AI Copilot"], ["noAds", "No ads"], ["noBranding", "No branding"],
];

function lim(n: number) { return n === -1 ? "Unlimited" : String(n); }

/** Pricing/plan cards used on the billing page (and reusable on the public pricing page). */
export function PlanCards({ plans, currentPlanId, paymentsEnabled }: { plans: Plan[]; currentPlanId: string | null; paymentsEnabled: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((p) => {
        const f = planFeatures(p);
        const current = p.id === currentPlanId;
        const order = plans.findIndex((x) => x.id === p.id);
        const currentOrder = plans.findIndex((x) => x.id === currentPlanId);
        const label = current ? "Current plan" : p.isFree ? "Free" : currentOrder === -1 || order > currentOrder ? "Upgrade" : "Downgrade";
        return (
          <div key={p.id} className={"card p-5 flex flex-col " + (p.isFeatured ? "border-primary ring-1 ring-primary/30" : "")}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{p.isFeatured && <span className="badge-blue">Popular</span>}</div>
            {p.description && <p className="text-xs text-muted mt-1">{p.description}</p>}
            <div className="my-4">
              {p.isFree ? <p className="text-3xl font-bold">Free</p> : (
                <>
                  {p.priceMonthly > 0 && <p className="text-3xl font-bold">{formatMoney(p.priceMonthly, p.currency)}<span className="text-sm text-muted font-normal">/mo</span></p>}
                  {p.priceYearly > 0 && <p className="text-xs text-muted">{formatMoney(p.priceYearly, p.currency)}/year</p>}
                  {p.priceLifetime > 0 && <p className="text-xs text-muted">{formatMoney(p.priceLifetime, p.currency)} lifetime</p>}
                  {p.trialDays > 0 && <p className="text-xs text-success mt-1">{p.trialDays}-day free trial</p>}
                </>
              )}
            </div>
            <ul className="text-sm space-y-1 mb-4 flex-1">
              <li>{lim(p.limitLinks)} links{p.limitLinksMonthly !== -1 ? ` (${p.limitLinksMonthly}/month)` : ""}</li>
              <li>{lim(p.limitBioPages)} bio pages · {lim(p.limitQrCodes)} QR codes</li>
              <li>{lim(p.limitDomains)} custom domains · {lim(p.limitCampaigns)} campaigns</li>
              <li>{lim(p.limitTeamMembers)} team members · {lim(p.limitApiKeys)} API keys</li>
              {p.limitFiles !== 0 && <li>{lim(p.limitFiles)} hosted files ({lim(p.limitStorageMb)} MB)</li>}
              {p.limitSms !== 0 && <li>{lim(p.limitSms)} SMS/month</li>}
              {p.limitAiCredits !== 0 && <li>{lim(p.limitAiCredits)} AI credits/month</li>}
              {FEATURE_LABELS.filter(([k]) => f[k] === true).map(([k, label]) => <li key={k} className="flex items-center gap-1.5 text-muted"><Check size={14} className="text-success" />{label}</li>)}
            </ul>
            {current ? <span className="btn-secondary w-full justify-center opacity-70">Current plan</span> : p.isFree ? <span className="btn-ghost w-full justify-center">Downgrade on expiry</span> : paymentsEnabled ? <Link href={`/checkout/${p.id}?interval=${p.priceMonthly > 0 ? "monthly" : p.priceYearly > 0 ? "yearly" : "lifetime"}`} className="btn-primary w-full justify-center">{label}</Link> : <span className="btn-secondary w-full justify-center opacity-70">Contact us</span>}
          </div>
        );
      })}
    </div>
  );
}
