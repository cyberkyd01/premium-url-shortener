"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

export type Interval = "monthly" | "yearly" | "lifetime";

export interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  priceLifetime: number;
  isFree: boolean;
  isFeatured: boolean;
  trialDays: number;
  limits: { label: string; value: string }[];
  features: { label: string; included: boolean }[];
}

export function PricingGrid({ plans, currency, loggedIn, teaser = false }: { plans: PricingPlan[]; currency: string; loggedIn: boolean; teaser?: boolean }) {
  const hasYearly = plans.some((p) => p.priceYearly > 0);
  const hasLifetime = plans.some((p) => p.priceLifetime > 0);
  const [interval, setInterval] = useState<Interval>("monthly");
  const intervals: Interval[] = ["monthly", ...(hasYearly ? (["yearly"] as Interval[]) : []), ...(hasLifetime ? (["lifetime"] as Interval[]) : [])];

  function priceOf(p: PricingPlan) {
    if (p.isFree) return 0;
    if (interval === "yearly") return p.priceYearly || p.priceMonthly * 12;
    if (interval === "lifetime") return p.priceLifetime;
    return p.priceMonthly;
  }
  function href(p: PricingPlan) {
    if (!loggedIn) return "/register";
    if (p.isFree) return "/dashboard";
    return `/checkout/${p.id}?interval=${interval}`;
  }
  const cols = Math.min(plans.length, 4);

  return (
    <div>
      {intervals.length > 1 && (
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            {intervals.map((i) => (
              <button key={i} type="button" onClick={() => setInterval(i)} className={cn("px-4 py-1.5 rounded-md capitalize", interval === i ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}>
                {i}{i === "yearly" && <span className="ml-1 text-xs opacity-80">(save)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={cn("grid gap-6", cols >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : cols === 3 ? "md:grid-cols-3" : cols === 2 ? "md:grid-cols-2" : "max-w-sm mx-auto")}>
        {plans.map((p) => {
          const price = priceOf(p);
          const unavailable = !p.isFree && interval === "lifetime" && p.priceLifetime <= 0;
          return (
            <div key={p.id} className={cn("card p-6 flex flex-col relative", p.isFeatured && "border-primary ring-2 ring-primary/30")}>
              {p.isFeatured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge-blue">Most popular</span>}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              {p.description && <p className="text-sm text-muted mt-1">{p.description}</p>}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{unavailable ? "—" : formatMoney(price, currency)}</span>
                {!p.isFree && !unavailable && <span className="text-sm text-muted">/ {interval === "lifetime" ? "once" : interval === "yearly" ? "year" : "month"}</span>}
              </div>
              {p.trialDays > 0 && !p.isFree && <span className="badge-green mt-2 self-start">{p.trialDays}-day free trial</span>}
              <a href={unavailable ? "#" : href(p)} aria-disabled={unavailable} className={cn("mt-5 w-full", p.isFeatured ? "btn-primary" : "btn-secondary", unavailable && "opacity-50 pointer-events-none")}>
                {p.isFree ? "Get started" : loggedIn ? "Choose plan" : "Sign up"}
              </a>
              {!teaser && (
                <>
                  <ul className="mt-6 space-y-2 text-sm">
                    {p.limits.map((l) => <li key={l.label} className="flex justify-between gap-2"><span className="text-muted">{l.label}</span><span className="font-medium">{l.value}</span></li>)}
                  </ul>
                  <ul className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f.label} className={cn("flex items-center gap-2", !f.included && "text-muted line-through")}>
                        {f.included ? <Check size={14} className="text-success shrink-0" /> : <X size={14} className="shrink-0 opacity-60" />}{f.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {teaser && (
                <ul className="mt-6 space-y-1.5 text-sm">
                  {p.limits.slice(0, 4).map((l) => <li key={l.label} className="flex items-center gap-2"><Check size={14} className="text-success shrink-0" />{l.value} {l.label.toLowerCase()}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
