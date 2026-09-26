"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Card, Input, Select, Alert, Button } from "@/components/ui";
import { SubmitButton, FormMessage } from "@/components/ui/form-state";
import { formatMoney } from "@/lib/utils";
import { COUNTRIES } from "./countries";
import { quote, startCheckout, startTrial, type Quote } from "@/app/checkout/actions";

export interface CheckoutPlan { id: string; name: string; description: string | null; priceMonthly: number; priceYearly: number; priceLifetime: number; currency: string; trialDays: number }
export interface CheckoutGateway { slug: string; name: string; supportsSubscriptions: boolean }

export function CheckoutForm({ plan, interval: initialInterval, gateways, user, initialQuote, trialEligible, taxEnabled, initialCoupon = "" }: { plan: CheckoutPlan; interval: string; gateways: CheckoutGateway[]; user: { name: string; email: string }; initialQuote: Quote; trialEligible: boolean; taxEnabled: boolean; initialCoupon?: string }) {
  const [interval, setInterval] = useState(initialInterval);
  const [coupon, setCoupon] = useState(initialCoupon);
  const [country, setCountry] = useState("");
  const [q, setQ] = useState<Quote>(initialQuote);
  const [pending, start] = useTransition();
  const [state, action] = useActionState(startCheckout, null);
  const [trialState, trialAction] = useActionState(startTrial, null);
  const [gateway, setGateway] = useState(gateways[0]?.slug ?? "");
  const intervals = [["monthly", plan.priceMonthly, "/month"], ["yearly", plan.priceYearly, "/year"], ["lifetime", plan.priceLifetime, " once"]].filter(([, p]) => Number(p) > 0) as [string, number, string][];

  useEffect(() => { start(async () => setQ(await quote({ planId: plan.id, interval, coupon: coupon || undefined, country: country || undefined }))); }, [interval, country]); // eslint-disable-line react-hooks/exhaustive-deps
  const applyCoupon = () => start(async () => setQ(await quote({ planId: plan.id, interval, coupon: coupon || undefined, country: country || undefined })));
  const data = state?.data as { pending?: boolean; clientSecret?: string; publicKey?: string; gateway?: string; extra?: Record<string, string> } | undefined;
  const t = q.totals;
  const gw = gateways.find((g) => g.slug === gateway);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="interval" value={interval} />
      <input type="hidden" name="coupon" value={q.coupon ? coupon : ""} />
      <div className="lg:col-span-2 space-y-6">
        <Card title="Billing period">
          <div className="grid gap-2 sm:grid-cols-3">
            {intervals.map(([key, price, suffix]) => (
              <button type="button" key={key} onClick={() => setInterval(key)} className={"rounded-lg border p-4 text-left transition " + (interval === key ? "border-primary bg-primary/5" : "border-border hover:bg-bg")}>
                <p className="text-sm font-medium capitalize">{key}</p>
                <p className="text-lg font-bold">{formatMoney(price, plan.currency)}<span className="text-xs font-normal text-muted">{suffix}</span></p>
                {key === "yearly" && plan.priceMonthly > 0 && plan.priceYearly < plan.priceMonthly * 12 && <p className="text-xs text-success">Save {Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)}%</p>}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Billing details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Full name / company" name="name" defaultValue={user.name} required />
            <Input label="Email" value={user.email} readOnly disabled />
            <Input label="Address" name="address" className="sm:col-span-2" />
            <Input label="City" name="city" />
            <Input label="ZIP / Postal code" name="zip" />
            <Select label="Country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
              <option value="">Select country</option>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </Select>
            <Input label="State / Region" name="state" />
            {taxEnabled && <Input label="VAT / Tax ID (optional)" name="vat" className="sm:col-span-2" />}
          </div>
        </Card>
        <Card title="Payment method">
          {gateways.length === 0 ? <Alert type="warning">No payment methods are available right now. Please contact support.</Alert> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {gateways.map((g) => (
                <label key={g.slug} className={"flex items-center gap-3 rounded-lg border p-3 cursor-pointer " + (gateway === g.slug ? "border-primary bg-primary/5" : "border-border")}>
                  <input type="radio" name="gateway" value={g.slug} checked={gateway === g.slug} onChange={() => setGateway(g.slug)} />
                  <span className="text-sm font-medium">{g.name}</span>
                  {!g.supportsSubscriptions && interval !== "lifetime" && <span className="text-xs text-muted ml-auto">manual renewal</span>}
                </label>
              ))}
            </div>
          )}
          {gw && !gw.supportsSubscriptions && interval !== "lifetime" && <p className="hint mt-2">This payment method does not support automatic renewals: you will receive a reminder to renew before your plan expires.</p>}
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Order summary">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>{plan.name} ({interval})</span><span>{formatMoney(t.subtotal, t.currency)}</span></div>
            {t.discount > 0 && <div className="flex justify-between text-success"><span>Discount {q.coupon ? `(${q.coupon.code})` : ""}</span><span>-{formatMoney(t.discount, t.currency)}</span></div>}
            {t.tax > 0 && <div className="flex justify-between"><span>{t.taxName || "Tax"} ({t.taxRate}%)</span><span>{formatMoney(t.tax, t.currency)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span>{q.coupon?.isVoucher ? formatMoney(0, t.currency) : formatMoney(t.total, t.currency)}</span></div>
          </div>
          <div className="mt-4">
            <label className="label">Coupon or voucher code</label>
            <div className="flex gap-2"><input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="CODE" /><Button type="button" variant="secondary" onClick={applyCoupon} disabled={pending}>Apply</Button></div>
            {q.error && <p className="hint text-danger">{q.error}</p>}
            {q.coupon && <p className="hint text-success">{q.coupon.description}</p>}
          </div>
          <div className="mt-4 space-y-3">
            <FormMessage state={state} />
            {data?.pending && <Alert type="info"><pre className="whitespace-pre-wrap font-sans text-sm">{state?.message}</pre></Alert>}
            {data?.clientSecret && <ClientCheckout data={data} />}
            {!data?.pending && <SubmitButton className="w-full" >{q.coupon?.isVoucher ? "Redeem voucher" : `Pay ${formatMoney(t.total, t.currency)}`}</SubmitButton>}
            <p className="text-xs text-muted text-center">Secure payment. You can cancel anytime from your billing page.</p>
          </div>
        </Card>
        {trialEligible && plan.trialDays > 0 && (
          <Card title={`${plan.trialDays}-day free trial`}>
            <p className="text-sm text-muted mb-3">Try {plan.name} free for {plan.trialDays} days. No payment required now.</p>
            <FormMessage state={trialState} />
            <Button type="submit" variant="secondary" className="w-full" formAction={trialAction} formNoValidate>Start free trial</Button>
          </Card>
        )}
      </div>
    </form>
  );
}

/** Gateways returning a client token (Razorpay / Paddle inline) are completed via their JS widget. */
function ClientCheckout({ data }: { data: { clientSecret?: string; publicKey?: string; gateway?: string; extra?: Record<string, string> } }) {
  const [msg, setMsg] = useState("Loading payment widget…");
  useEffect(() => {
    const extra = data.extra ?? {};
    if (data.gateway === "razorpay") {
      const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => {
        const RZ = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay;
        const opts: Record<string, unknown> = { key: data.publicKey, name: extra.name, prefill: { email: extra.email }, handler: () => { window.location.href = extra.successUrl || "/checkout/success"; } };
        if (extra.kind === "subscription") opts.subscription_id = data.clientSecret; else { opts.order_id = data.clientSecret; opts.amount = extra.amount; opts.currency = extra.currency; }
        new RZ(opts).open(); setMsg("Complete the payment in the Razorpay window.");
      }; document.body.appendChild(s);
    } else if (data.gateway === "paddle") {
      const s = document.createElement("script"); s.src = "https://cdn.paddle.com/paddle/v2/paddle.js"; s.onload = () => {
        const P = (window as unknown as { Paddle: { Environment: { set: (e: string) => void }; Initialize: (o: Record<string, unknown>) => void; Checkout: { open: (o: Record<string, unknown>) => void } } }).Paddle;
        if (extra.environment === "sandbox") P.Environment.set("sandbox");
        P.Initialize({ token: data.publicKey }); P.Checkout.open({ transactionId: data.clientSecret }); setMsg("Complete the payment in the Paddle window.");
      }; document.body.appendChild(s);
    } else setMsg("Unsupported client checkout");
  }, [data]);
  return <Alert type="info">{msg}</Alert>;
}
