import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getSettings } from "@/lib/settings";
import { getUserPlan } from "@/lib/plan";
import { Alert, Card, PageHeader, Stat } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { SlugTool, BioTool, InsightsTool } from "./ai-tools";

export const metadata = { title: "AI Copilot" };

export default async function AiPage() {
  const ws = await getWorkspace();
  if (!ws) redirect("/login");
  const s = await getSettings();
  if (s["ai.enabled"] !== "1") return <div><PageHeader title="AI Copilot" /><Alert type="info">AI Copilot is not enabled on this site.</Alert></div>;
  const { user, plan, features } = await getUserPlan(ws.userId);
  const isAdmin = user.role === "admin";
  if (!isAdmin && !features.aiCopilot) return <div><PageHeader title="AI Copilot" /><Alert type="warning">Your plan does not include AI Copilot. <Link href="/dashboard/billing" className="underline">Upgrade</Link> to unlock it.</Alert></div>;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [usage, links, monthCount] = await Promise.all([
    db.aiUsage.findMany({ where: { userId: ws.userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.link.findMany({ where: { userId: ws.ownerId, isArchived: false }, select: { id: true, alias: true, title: true, clicks: true }, orderBy: { clicks: "desc" }, take: 200 }),
    db.aiUsage.aggregate({ where: { userId: ws.userId, createdAt: { gte: monthStart } }, _sum: { credits: true } }),
  ]);
  const limit = isAdmin ? -1 : plan?.limitAiCredits ?? parseInt(s["ai.monthlyCredits"] || "0", 10);
  const used = monthCount._sum.credits ?? 0;
  const enabledFeatures = (s["ai.features"] || "").split(",");
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="space-y-6">
      <PageHeader title="AI Copilot" description="Smart helpers for slugs, bio pages and analytics." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5 sm:col-span-2">
          <p className="text-sm text-muted">Credits this month</p>
          <p className="text-2xl font-bold mt-1">{used}{limit === -1 ? "" : ` / ${limit}`}</p>
          <div className="h-2 rounded-full bg-bg mt-2 overflow-hidden"><div className={"h-full " + (pct >= 90 ? "bg-danger" : "bg-primary")} style={{ width: `${limit === -1 ? 3 : pct}%` }} /></div>
          <p className="hint">1 credit per request. Credits reset monthly.</p>
        </div>
        <Stat label="Provider" value={<span className="capitalize">{s["ai.provider"]}</span>} sub={s["ai.model"] || "default model"} />
      </div>
      {limit !== -1 && used >= limit && <Alert type="warning">You have used all your AI credits for this month.</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        {enabledFeatures.includes("slug") && <SlugTool />}
        {enabledFeatures.includes("insights") && <InsightsTool links={links} />}
        {enabledFeatures.includes("bio") && <div className="lg:col-span-2"><BioTool /></div>}
      </div>
      <Card title="Usage history">
        {usage.length === 0 ? <p className="text-sm text-muted">No AI requests yet.</p> : (
          <div className="overflow-x-auto -mx-5 -my-5"><table className="table">
            <thead><tr><th>Date</th><th>Feature</th><th>Provider</th><th>Tokens</th><th>Credits</th></tr></thead>
            <tbody>{usage.map((r) => <tr key={r.id}><td className="whitespace-nowrap">{formatDate(r.createdAt, true)}</td><td className="capitalize">{r.feature}</td><td className="capitalize">{r.provider}</td><td>{r.tokens}</td><td>{r.credits}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
