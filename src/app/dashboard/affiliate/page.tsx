import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { affiliateStats } from "@/lib/affiliate";
import { Alert, Badge, Card, CopyButton, PageHeader, Stat } from "@/components/ui";
import { appUrl, formatDate, formatMoney } from "@/lib/utils";
import { PayoutForm } from "./payout-form";
import { ensureAffiliateCode } from "./actions";

export const metadata = { title: "Affiliate program" };

export default async function AffiliatePage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["affiliate.enabled"] !== "1") return <div><PageHeader title="Affiliate program" /><Alert type="info">The affiliate program is currently disabled.</Alert></div>;
  const code = await ensureAffiliateCode();
  const st = await affiliateStats(ws.userId);
  const currency = s["payments.currency"] || "USD";
  const tag = s["affiliate.tagType"] === "username" ? st.username : code;
  const link = appUrl(`/?ref=${encodeURIComponent(tag)}`);
  const min = parseFloat(s["affiliate.minPayout"] || "0");
  const available = Math.max(0, st.balance - st.requested);
  const commission = s["affiliate.commissionType"] === "fixed" ? formatMoney(parseFloat(s["affiliate.commission"] || "0"), currency) : `${s["affiliate.commission"]}%`;
  const color = (x: string) => (x === "paid" ? "green" : x === "approved" ? "blue" : x === "rejected" ? "red" : "yellow");
  return (
    <div className="space-y-6">
      <PageHeader title="Affiliate program" description={`Earn ${commission} commission on ${s["affiliate.frequency"] === "recurring" ? "every payment" : "the first payment"} made by users you refer. Referral cookie lasts ${s["affiliate.cookieDays"]} days.`} />
      <Card title="Your referral link">
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-bg px-3 py-2 rounded-lg text-sm flex-1 min-w-64 break-all">{link}</code>
          <CopyButton text={link} />
        </div>
        <p className="hint mt-2">Share this link anywhere. Anyone who signs up after clicking it becomes your referral.</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Referrals" value={st.referrals} sub="users who signed up with your link" />
        <Stat label="Total earned" value={formatMoney(st.total, currency)} sub={`pending ${formatMoney(st.pending, currency)} · approved ${formatMoney(st.approved, currency)}`} />
        <Stat label="Paid out" value={formatMoney(st.paid, currency)} />
        <Stat label="Balance" value={formatMoney(st.balance, currency)} sub={st.requested > 0 ? `${formatMoney(st.requested, currency)} requested` : `min payout ${formatMoney(min, currency)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Earnings" className="lg:col-span-2">
          {st.earnings.length === 0 ? <p className="text-sm text-muted">No commissions yet. Share your link to start earning.</p> : (
            <div className="overflow-x-auto -mx-5"><table className="table">
              <thead><tr><th>Date</th><th>Referral</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>{st.earnings.map((e) => <tr key={e.id}><td>{formatDate(e.createdAt)}</td><td className="font-mono text-xs">{e.referredId.slice(0, 8)}…</td><td>{formatMoney(e.amount, currency)}</td><td><Badge color={color(e.status)}>{e.status}</Badge></td></tr>)}</tbody>
            </table></div>
          )}
        </Card>
        <Card title="Request a payout"><PayoutForm available={available} min={min} currency={currency} /></Card>
      </div>
      <Card title="Payout history">
        {st.payouts.length === 0 ? <p className="text-sm text-muted">No payouts yet.</p> : (
          <div className="overflow-x-auto -mx-5"><table className="table">
            <thead><tr><th>Requested</th><th>Amount</th><th>Method</th><th>Status</th><th>Paid</th></tr></thead>
            <tbody>{st.payouts.map((p) => <tr key={p.id}><td>{formatDate(p.createdAt)}</td><td>{formatMoney(p.amount, currency)}</td><td className="capitalize">{p.method}</td><td><Badge color={color(p.status)}>{p.status}</Badge></td><td>{p.paidAt ? formatDate(p.paidAt) : "-"}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
