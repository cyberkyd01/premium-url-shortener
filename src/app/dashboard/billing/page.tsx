import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { Alert, Badge, Card, PageHeader, Stat } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { PlanCards } from "@/components/billing/plan-cards";
import { SubscriptionControls, RedeemForm } from "./billing-forms";

export const metadata = { title: "Billing & plans" };

function pct(used: number, limit: number) { return limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)); }
function limitText(n: number) { return n === -1 ? "Unlimited" : String(n); }

export default async function BillingPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  const userId = ws.userId;
  const { user, plan } = await getUserPlan(userId);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [plans, sub, payments, counts] = await Promise.all([
    db.plan.findMany({ where: { isPublic: true }, orderBy: { sortOrder: "asc" } }),
    db.subscription.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } }, take: 50 }),
    Promise.all([
      db.link.count({ where: { userId } }), db.link.count({ where: { userId, createdAt: { gte: monthStart } } }), db.bioPage.count({ where: { userId } }), db.qrCode.count({ where: { userId } }),
      db.domain.count({ where: { userId } }), db.campaign.count({ where: { userId } }), db.pixel.count({ where: { userId } }), db.splashPage.count({ where: { userId } }), db.overlay.count({ where: { userId } }),
      db.teamMember.count({ where: { team: { ownerId: userId } } }), db.apiKey.count({ where: { userId } }), db.hostedFile.count({ where: { userId } }), db.smsMessage.count({ where: { userId, createdAt: { gte: monthStart } } }),
    ]),
  ]);
  const [links, linksMonthly, bio, qr, domains, campaigns, pixels, splash, overlays, members, apiKeys, files, sms] = counts;
  const usage: [string, number, number][] = plan ? [
    ["Links", links, plan.limitLinks], ["Links this month", linksMonthly, plan.limitLinksMonthly], ["Bio pages", bio, plan.limitBioPages], ["QR codes", qr, plan.limitQrCodes], ["Custom domains", domains, plan.limitDomains],
    ["Campaigns", campaigns, plan.limitCampaigns], ["Pixels", pixels, plan.limitPixels], ["Splash pages", splash, plan.limitSplash], ["Overlays", overlays, plan.limitOverlays], ["Team members", members, plan.limitTeamMembers],
    ["API keys", apiKeys, plan.limitApiKeys], ["Hosted files", files, plan.limitFiles], ["Storage (MB)", Math.round(user.storageUsed / 1048576), plan.limitStorageMb], ["SMS this month", sms, plan.limitSms], ["AI credits this month", user.aiCredits, plan.limitAiCredits],
  ] : [];
  const expired = !!user.planExpires && user.planExpires < new Date() && !plan?.isFree;
  const onTrial = !!user.planTrialEnds && user.planTrialEnds > new Date();
  const pendingBank = payments.find((p) => p.status === "pending" && p.gateway === "bank");
  const paymentsEnabled = s["payments.enabled"] === "1";
  const statusColor = (st: string) => (st === "completed" ? "green" : st === "pending" ? "yellow" : st === "refunded" ? "blue" : "red");
  return (
    <div className="space-y-6">
      <PageHeader title="Billing & plans" description="Your subscription, usage and invoices." />
      {pendingBank && <Alert type="warning">Your bank transfer for <strong>{pendingBank.plan?.name}</strong> ({formatMoney(pendingBank.amount, pendingBank.currency)}) is awaiting confirmation. Reference: <code>{pendingBank.id}</code>. {s["payments.bankDetails"] && <details className="mt-1"><summary className="cursor-pointer underline">Bank details</summary><pre className="whitespace-pre-wrap text-xs mt-1">{s["payments.bankDetails"]}</pre></details>}</Alert>}
      {expired && <Alert type="error">Your plan expired on {formatDate(user.planExpires)}. You are on the free plan until you renew.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current plan" value={plan?.name ?? "Free"} sub={onTrial ? `Trial ends ${formatDate(user.planTrialEnds)}` : user.planExpires && !plan?.isFree ? `${expired ? "Expired" : "Renews/expires"} ${formatDate(user.planExpires)}` : "No expiry"} />
        <Stat label="Subscription" value={sub ? <span className="capitalize">{sub.status}</span> : "None"} sub={sub ? `${sub.gateway} · ${sub.interval}${sub.currentPeriodEnd ? ` · until ${formatDate(sub.currentPeriodEnd)}` : ""}` : "Pick a plan below"} />
        <Stat label="Payments" value={payments.filter((p) => p.status === "completed").length} sub="completed invoices" />
        <Stat label="Total spent" value={formatMoney(payments.filter((p) => p.status === "completed").reduce((a, p) => a + p.amount, 0), s["payments.currency"] || "USD")} />
      </div>
      {sub && sub.status !== "expired" && sub.gateway !== "trial" && sub.gateway !== "voucher" && sub.interval !== "lifetime" && (
        <Card title="Subscription" description={sub.status === "cancelled" ? `Cancelled. Access continues until ${formatDate(sub.cancelAt ?? sub.currentPeriodEnd)}.` : `Renews automatically via ${sub.gateway}.`}>
          <SubscriptionControls id={sub.id} status={sub.status} />
        </Card>
      )}
      <Card title="Usage" description="Your consumption against plan limits.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usage.map(([label, used, limit]) => (
            <div key={label} className="text-sm">
              <div className="flex justify-between"><span>{label}</span><span className="text-muted">{used} / {limitText(limit)}</span></div>
              <div className="h-1.5 rounded-full bg-bg mt-1 overflow-hidden"><div className={"h-full " + (pct(used, limit) >= 90 ? "bg-danger" : "bg-primary")} style={{ width: `${limit === -1 ? 5 : pct(used, limit)}%` }} /></div>
            </div>
          ))}
        </div>
      </Card>
      <div>
        <h2 className="text-lg font-semibold mb-3">Plans</h2>
        <PlanCards plans={plans} currentPlanId={plan?.id ?? null} paymentsEnabled={paymentsEnabled} />
        {s["payments.customPlanBanner"] === "1" && <p className="text-sm text-muted mt-3">{s["payments.customPlanText"]} <Link href={s["payments.customPlanUrl"] || "/contact"} className="text-primary underline">Contact us</Link></p>}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Payment history" className="lg:col-span-2">
          {payments.length === 0 ? <p className="text-sm text-muted">No payments yet.</p> : (
            <div className="overflow-x-auto -mx-5"><table className="table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
              <tbody>{payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.invoiceNumber ?? "-"}</td><td className="whitespace-nowrap">{formatDate(p.createdAt)}</td><td>{p.plan?.name ?? "-"} <span className="text-xs text-muted">({p.interval})</span></td>
                  <td>{formatMoney(p.amount, p.currency)}</td><td className="capitalize">{p.gateway}</td><td><Badge color={statusColor(p.status)}>{p.status}</Badge></td>
                  <td className="text-right">{p.status === "completed" && <Link href={`/invoice/${p.id}`} className="btn-secondary btn-sm" target="_blank">Invoice</Link>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Redeem a code" description="Vouchers activate a plan for free; coupons give a discount at checkout."><RedeemForm plans={plans.filter((p) => !p.isFree).map((p) => ({ id: p.id, name: p.name }))} /></Card>
      </div>
    </div>
  );
}
